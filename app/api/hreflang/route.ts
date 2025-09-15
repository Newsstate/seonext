import { NextRequest } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

async function readAlternates(html: string, base: string) {
  const $ = cheerio.load(html);
  const list: Array<{ lang: string; href: string }> = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = String($(el).attr('hreflang') || '').trim();
    const href = String($(el).attr('href') || '').trim();
    if (!lang || !href) return;
    try { list.push({ lang, href: new URL(href, base).toString() }); } catch {}
  });
  return list;
}

export async function POST(req: NextRequest) {
  try {
    const { url, limit = 10 } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });
    const ua = 'Mozilla/5.0 (compatible; SEOMagic/1.3)';
    const src = await got(url, { headers:{'user-agent':ua}, timeout:{request:15000}, followRedirect: true });
    const srcList = await readAlternates(src.body, src.url);
    const pick = srcList.slice(0, limit);

    const results: any[] = [];
    for (const alt of pick) {
      try {
        const r = await got(alt.href, { headers:{'user-agent':ua}, timeout:{request:15000}, followRedirect: true });
        const back = await readAlternates(r.body, r.url);
        const reciprocal = back.some(b => {
          try { return new URL(b.href).toString() === new URL(src.url).toString(); }
          catch { return false; }
        });
        results.push({ lang: alt.lang, url: alt.href, status: r.statusCode, reciprocal });
      } catch (e:any) {
        results.push({ lang: alt.lang, url: alt.href, error: String(e.message||e) });
      }
    }

    return new Response(JSON.stringify({ ok:true, data: { source: src.url, total: srcList.length, checked: results.length, results } }), {
      status:200, headers:{'content-type':'application/json'}
    });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
