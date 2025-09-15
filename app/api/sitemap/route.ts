import { NextRequest } from 'next/server';
import got from 'got';
import { XMLParser } from 'fast-xml-parser';

export const runtime = 'nodejs';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true
});

async function fetchText(url: string) {
  const r = await got(url, { timeout: { request: 15000 }, retry: { limit: 1 }, throwHttpErrors: false });
  if (r.statusCode >= 400) throw new Error(`${r.statusCode} for ${url}`);
  return r.body;
}

async function discoverSitemaps(origin: string) {
  const robotsUrl = `${origin}/robots.txt`;
  const out: string[] = [];
  try {
    const txt = await fetchText(robotsUrl);
    const lines = txt.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.split('#')[0].trim();
      if (!line) continue;
      const [k, ...rest] = line.split(':');
      if (k && k.toLowerCase() === 'sitemap') {
        const v = rest.join(':').trim();
        if (v) out.push(v);
      }
    }
  } catch { /* no robots or error */ }
  if (!out.length) out.push(`${origin}/sitemap.xml`);
  return out;
}

function ensureArray<T>(x: any): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

async function parseSitemap(url: string, hardLimit = 200) {
  const xml = await fetchText(url);
  const obj = parser.parse(xml);

  // sitemapindex
  if (obj.sitemapindex) {
    const entries = ensureArray<any>(obj.sitemapindex.sitemap).slice(0, 25);
    const urls: { loc: string; lastmod?: string }[] = [];
    for (const s of entries) {
      const loc = s.loc || s?.loc?.['#text'];
      if (!loc) continue;
      try {
        const nested = await parseSitemap(loc, hardLimit - urls.length);
        urls.push(...nested.urls);
        if (urls.length >= hardLimit) break;
      } catch { /* ignore broken child */ }
    }
    return { type: 'index' as const, urls };
  }

  // urlset
  if (obj.urlset) {
    const items = ensureArray<any>(obj.urlset.url);
    const urls = items
      .map(u => ({ loc: u.loc || u?.loc?.['#text'], lastmod: u.lastmod }))
      .filter(x => !!x.loc)
      .slice(0, hardLimit);
    return { type: 'urlset' as const, urls };
  }

  return { type: 'unknown' as const, urls: [] };
}

export async function POST(req: NextRequest) {
  try {
    const { url, limit = 100 } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });
    const u = new URL(url);
    const origin = u.origin;

    const sitemaps = await discoverSitemaps(origin);
    const collected: { loc: string; lastmod?: string }[] = [];
    for (const sm of sitemaps) {
      try {
        const res = await parseSitemap(sm, limit - collected.length);
        collected.push(...res.urls);
        if (collected.length >= limit) break;
      } catch { /* skip broken sitemap */ }
    }

    // dedupe and normalize
    const seen = new Set<string>();
    const urls = collected.filter(x => {
      try {
        const loc = new URL(x.loc, origin).toString();
        if (seen.has(loc)) return false;
        seen.add(loc); x.loc = loc; return true;
      } catch { return false; }
    });

    return new Response(JSON.stringify({
      ok: true,
      data: {
        origin,
        sitemaps,
        count: urls.length,
        urls
      }
    }), { status:200, headers:{ 'content-type':'application/json' } });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
