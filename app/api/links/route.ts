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
    const { url, limit = 150 } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });

    const base = new URL(url);
    const ua = 'Mozilla/5.0 (compatible; SEOMagic/1.5)';
    const page = await got(url, { followRedirect: true, headers:{'user-agent': ua}, timeout:{ request: 15000 }, throwHttpErrors: false });

    const $ = cheerio.load(page.body);
    const anchors: Array<{ href:string; text:string; rel:string; target:string }> = [];
    $('a[href]').each((_, el)=>{
      const href = String($(el).attr('href') || '').trim();
      if (!href || href.startsWith('#') || /^mailto:|^tel:|^javascript:/i.test(href)) return;
      anchors.push({
        href: abs(base, href)!,
        text: $(el).text().trim().slice(0,120),
        rel: String($(el).attr('rel') || '').toLowerCase(),
        target: String($(el).attr('target') || '')
      });
    });

    // dedupe by href
    const seen = new Set<string>();
    const uniq = anchors.filter(a => { if (seen.has(a.href)) return false; seen.add(a.href); return true; }).slice(0, limit);

    const rows:any[] = [];
    for (const a of uniq) {
      let status: number | null = null;
      let finalUrl: string | null = null;
      let error: string | null = null;
      try {
        const head = await got(a.href, { method:'HEAD', followRedirect: true, throwHttpErrors: false, timeout:{ request: 12000 } });
        status = head.statusCode;
        finalUrl = head.url;
      } catch (e:any) {
        error = String(e.message || e);
      }
      const isExternal = (() => {
        try { return new URL(a.href).origin !== base.origin; } catch { return false; }
      })();
      const hasNoopener = a.rel.includes('noopener') || a.rel.includes('noreferrer');
      rows.push({
        url: a.href,
        text: a.text,
        status,
        finalUrl,
        error,
        internal: !isExternal,
        external: isExternal,
        nofollow: a.rel.includes('nofollow'),
        targetBlank: a.target === '_blank',
        targetBlankUnsafe: a.target === '_blank' && !hasNoopener
      });
    }

    return new Response(JSON.stringify({ ok:true, data:{ count: rows.length, rows } }), {
      status:200, headers:{ 'content-type':'application/json' }
    });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
