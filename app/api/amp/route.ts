import { NextRequest } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

function abs(base: URL, href?: string) {
  if (!href) return undefined;
  try { return new URL(href, base).toString(); } catch { return href; }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });
    const base = new URL(url);
    const ua = 'Mozilla/5.0 (compatible; SEOMagic/1.4)';
    const page = await got(url, { headers:{'user-agent':ua}, timeout:{request:15000}, followRedirect:true, throwHttpErrors:false });

    const $ = cheerio.load(page.body);
    const ampHref = $('link[rel="amphtml"]').attr('href');
    const ampUrl = ampHref ? abs(base, ampHref) : undefined;

    if (!ampUrl) {
      return new Response(JSON.stringify({ ok:true, data:{ hasAmp:false } }), { status:200 });
    }

    // fetch AMP page
    const amp = await got(ampUrl, { headers:{'user-agent':ua}, timeout:{request:15000}, followRedirect:true, throwHttpErrors:false });
    const ok = amp.statusCode < 400;
    const html = amp.body || '';
    const hasAmpHtml = /<html[^>]+\b(amp|⚡)\b/i.test(html);
    const hasCanonicalBack = /rel=["']canonical["']/i.test(html);

    return new Response(JSON.stringify({
      ok:true,
      data:{
        hasAmp:true,
        ampUrl,
        status: amp.statusCode,
        validHtmlFlag: hasAmpHtml,
        hasCanonicalBack
      }
    }), { status:200, headers:{ 'content-type':'application/json' } });

  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
