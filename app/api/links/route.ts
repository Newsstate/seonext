import { NextRequest } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

function abs(base: URL, href?: string) {
  if (!href) return undefined;
  try { return new URL(href, base).toString(); } catch { return undefined; }
}

function isSkippable(href: string) {
  return !href || href.startsWith('#') || /^mailto:|^tel:|^javascript:/i.test(href);
}

async function headOrLightGet(url: string) {
  try {
    const h = await got(url, { method: 'HEAD', throwHttpErrors: false, timeout: { request: 12000 }, followRedirect: true });
    return { status: h.statusCode, finalUrl: h.url };
  } catch {
    try {
      const g = await got(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, throwHttpErrors: false, timeout: { request: 12000 }, followRedirect: true });
      return { status: g.statusCode, finalUrl: g.url };
    } catch (e:any) {
      return { status: 0, finalUrl: url, error: String(e.message || e) };
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, limit = 60, scope = 'all' } = await req.json() as { url: string; limit?: number; scope?: 'all'|'internal'|'external' };
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });

    const base = new URL(url);
    const r = await got(url, { timeout:{ request:15000 }, followRedirect: true, throwHttpErrors: false });
    if (r.statusCode >= 400) return new Response(JSON.stringify({ ok:false, error:`${r.statusCode} on page` }), { status:200 });

    const $ = cheerio.load(r.body);
    const anchors: Array<{ url:string; text:string; rel:string; target?:string; type:'internal'|'external' }> = [];

    $('a[href]').each((_, el) => {
      const href = String($(el).attr('href') || '').trim();
      if (isSkippable(href)) return;
      const u = abs(base, href);
      if (!u) return;
      const rel = String($(el).attr('rel') || '').toLowerCase();
      const target = String($(el).attr('target') || '').toLowerCase() || undefined;
      let type:'internal'|'external' = 'external';
      try { type = new URL(u).origin === base.origin ? 'internal' : 'external'; } catch {}
      const text = $(el).text().replace(/\s+/g,' ').trim().slice(0,120);
      anchors.push({ url: u, text, rel, target, type });
    });

    // Filter & de-dupe
    let list = anchors;
    if (scope === 'internal') list = list.filter(a => a.type === 'internal');
    if (scope === 'external') list = list.filter(a => a.type === 'external');
    const seen = new Set<string>();
    list = list.filter(a => (seen.has(a.url) ? false : (seen.add(a.url), true))).slice(0, limit);

    const results = await Promise.all(list.map(async a => {
      const head = await headOrLightGet(a.url);
      const noopenerNeeded = a.type === 'external' && a.target === '_blank' && !/noopener|noreferrer/.test(a.rel);
      const nofollow = /nofollow/.test(a.rel);
      const ugc = /ugc/.test(a.rel);
      const sponsored = /sponsored/.test(a.rel);
      return {
        ...a,
        status: head.status,
        finalUrl: head.finalUrl,
        error: head.error,
        nofollow, ugc, sponsored,
        security: noopenerNeeded ? 'noopener-missing' : 'ok'
      };
    }));

    const counts = {
      totalOnPage: anchors.length,
      checked: results.length,
      internal: results.filter(r => r.type === 'internal').length,
      external: results.filter(r => r.type === 'external').length,
      errors: results.filter(r => r.status >= 400 || r.status === 0 || r.error).length
    };

    return new Response(JSON.stringify({ ok:true, data: { counts, results } }), { status:200, headers:{'content-type':'application/json'} });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
