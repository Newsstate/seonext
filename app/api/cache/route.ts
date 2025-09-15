import { NextRequest } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

function abs(base: URL, href?: string) {
  if (!href) return undefined;
  try { return new URL(href, base).toString(); } catch { return href; }
}
function parseMaxAge(cc?: string) {
  if (!cc) return null;
  const m = cc.match(/max-age\s*=\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

export async function POST(req: NextRequest) {
  try {
    const { url, limit = 60 } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });
    const base = new URL(url);
    const ua = 'Mozilla/5.0 (compatible; SEOMagic/1.5)';
    const page = await got(url, { followRedirect: true, headers:{'user-agent': ua}, timeout:{ request: 15000 }, throwHttpErrors: false });
    const $ = cheerio.load(page.body);

    const assets: string[] = [];
    $('link[rel="stylesheet"][href]').each((_, el)=> assets.push(abs(base, String($(el).attr('href')||''))!));
    $('script[src]').each((_, el)=> assets.push(abs(base, String($(el).attr('src')||''))!));
    $('img[src]').each((_, el)=> assets.push(abs(base, String($(el).attr('src')||''))!));

    // dedupe + cut
    const seen = new Set<string>();
    const uniq = assets.filter(u => { if (!u || seen.has(u)) return false; seen.add(u); return true; }).slice(0, limit);

    const rows:any[] = [];
    for (const u of uniq) {
      try {
        const h = await got(u, { method:'HEAD', followRedirect:true, throwHttpErrors:false, timeout:{ request: 12000 } });
        const type = String(h.headers['content-type'] || '');
        const len = Number(h.headers['content-length'] || NaN);
        const cc = String(h.headers['cache-control'] || '');
        const age = parseMaxAge(cc);
        rows.push({
          url: u,
          status: h.statusCode,
          bytes: Number.isFinite(len) ? len : null,
          type,
          cacheControl: cc || null,
          maxAge: age
        });
      } catch (e:any) {
        rows.push({ url: u, status: 0, bytes: null, type: '', cacheControl: null, maxAge: null, error: String(e.message||e) });
      }
    }

    // group & stats
    const tooLow = rows.filter(r => (r.maxAge ?? 0) < 86400); // < 1 day
    const imgs = rows.filter(r => /image\//i.test(r.type));
    const js   = rows.filter(r => /javascript|ecmascript/i.test(r.type) || /\.js(\?|$)/i.test(r.url));
    const css  = rows.filter(r => /text\/css/i.test(r.type) || /\.css(\?|$)/i.test(r.url));
    const totalBytes = rows.reduce((s,r)=> s + (r.bytes||0), 0);

    return new Response(JSON.stringify({
      ok:true,
      data: {
        count: rows.length,
        totalBytes,
        lowTtlCount: tooLow.length,
        byType: { images: imgs.length, js: js.length, css: css.length },
        rows
      }
    }), { status:200, headers:{ 'content-type':'application/json' }});
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
