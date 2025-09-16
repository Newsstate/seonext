import { NextRequest } from 'next/server';
import got from 'got';
import { parseSEO, extractMainText, readabilityStats, jaccard, scoreFrom } from '@/lib/seo';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

// --- Add near top of scan route (with other helpers) ---
import * as cheerio from 'cheerio';

const normalizeUrl = (href: string, baseUrl: string) => {
  try {
    const u = new URL(href, baseUrl);
    u.hash = '';
    if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch { return ''; }
};
const cap = <T,>(arr: T[], n = 200) => (arr.length > n ? arr.slice(0, n) : arr);

function extractImagesMissingAlt(html: string, baseUrl: string) {
  const $ = cheerio.load(html); const out = new Set<string>();
  $('img').each((_, el) => {
    const alt = String($(el).attr('alt') || '').trim();
    if (alt) return;
    const src = String($(el).attr('src') || '').trim();
    const abs = normalizeUrl(src, baseUrl);
    if (abs) out.add(abs);
  });
  return Array.from(out);
}
function extractImagesNoLazy(html: string, baseUrl: string) {
  const $ = cheerio.load(html); const out = new Set<string>();
  $('img').each((_, el) => {
    const src = String($(el).attr('src') || '').trim();
    if (!src || src.startsWith('data:')) return;
    const loading = String($(el).attr('loading') || '').toLowerCase();
    if (loading !== 'lazy') {
      const abs = normalizeUrl(src, baseUrl);
      if (abs) out.add(abs);
    }
  });
  return Array.from(out);
}
function extractImagesNoSize(html: string, baseUrl: string) {
  const $ = cheerio.load(html); const out = new Set<string>();
  $('img').each((_, el) => {
    const src = String($(el).attr('src') || '').trim();
    if (!src || src.startsWith('data:')) return;
    const w = $(el).attr('width'); const h = $(el).attr('height');
    if (!(w && String(w).trim() && h && String(h).trim())) {
      const abs = normalizeUrl(src, baseUrl);
      if (abs) out.add(abs);
    }
  });
  return Array.from(out);
}
function extractBlockingHeadScripts(html: string, baseUrl: string) {
  const $ = cheerio.load(html); const out: string[] = [];
  $('head script').each((_, el) => {
    const type = String($(el).attr('type') || '').toLowerCase();
    const isModule = type === 'module';
    const hasAsync = $(el).is('[async]'); const hasDefer = $(el).is('[defer]');
    const blocks = !isModule && !hasAsync && !hasDefer;
    if (!blocks) return;
    const src = String($(el).attr('src') || '').trim();
    if (src) {
      const abs = normalizeUrl(src, baseUrl);
      if (abs) out.push(abs);
    } else {
      const text = $(el).text().trim().slice(0, 80).replace(/\s+/g, ' ');
      out.push(`[inline] ${text}`);
    }
  });
  return out;
}
function extractAllLinks(html: string, baseUrl: string) {
  const $ = cheerio.load(html); const out = new Set<string>();
  const baseHref = $('base[href]').attr('href');
  const absBase = baseHref ? new URL(baseHref, baseUrl).toString() : baseUrl;
  $('a[href]').each((_, el) => {
    const href = String($(el).attr('href') || '').trim();
    const abs = normalizeUrl(href, absBase);
    if (abs) out.add(abs);
  });
  return Array.from(out);
}

async function fetchHtml(url: string, ua: string) {
  const r = await got(url, {
    http2: true,
    headers: { 'user-agent': ua },
    timeout: { request: 15000 },
    retry: { limit: 1 },
    followRedirect: true,
  });
  return r;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Missing url' }), { status: 400 });
    }

    const ua = 'Mozilla/5.0 (compatible; SEOMagic/1.3; +https://example.com)';
    const resp = await fetchHtml(url, ua);

    const parsed = parseSEO(resp.body, url, resp.headers as any, resp.statusCode);
    parsed.finalUrl = resp.url;
    parsed.redirected = parsed.finalUrl !== url;

    // content stats
    const main = extractMainText(resp.body);
    parsed.contentStats = readabilityStats(main.text);
    if (parsed.contentStats.words < 300) {
      parsed._warnings.push(`Low word count (${parsed.contentStats.words}).`);
    }

    // duplicate / canonical drift
    if (parsed.canonical && parsed.canonical !== parsed.finalUrl && parsed.canonicalStatus !== 'multiple') {
      try {
        const can = await fetchHtml(parsed.canonical, ua);
        const b = extractMainText(can.body);
        const sim = jaccard(main.text, b.text);
        let risk: 'low' | 'medium' | 'high' = 'low';
        if (sim >= 0.85) risk = 'high';
        else if (sim >= 0.60) risk = 'medium';
        parsed.duplication = {
          comparedUrl: can.url,
          similarity: Number(sim.toFixed(3)),
          pageWords: main.words,
          comparedWords: b.words,
          risk,
        };
        if (risk === 'high') parsed._warnings.push(`Content near-duplicate with canonical (${sim.toFixed(2)}).`);
        else if (risk === 'medium') parsed._warnings.push(`Content similarity with canonical (${sim.toFixed(2)}).`);
      } catch { /* ignore */ }
    }

    // score
    parsed.score = scoreFrom(parsed);

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
