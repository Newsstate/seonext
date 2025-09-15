import { NextRequest } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

function abs(base: URL, href?: string) {
  if (!href) return undefined;
  try { return new URL(href, base).toString(); } catch { return href; }
}

async function headOrLightGet(url: string) {
  try {
    const h = await got(url, { method: 'HEAD', timeout:{request:12000}, throwHttpErrors:false });
    const len = Number(h.headers['content-length'] || NaN);
    return {
      status: h.statusCode,
      bytes: Number.isFinite(len) ? len : null,
      type: String(h.headers['content-type'] || ''),
      via: 'HEAD' as const
    };
  } catch {
    // fallback: byte-range GET to avoid full download
    try {
      const g = await got(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        timeout: { request: 12000 },
        throwHttpErrors: false
      });
      // try to read size from Content-Range: bytes 0-0/123456
      const cr = String(g.headers['content-range'] || '');
      const m = cr.match(/\/(\d+)\s*$/);
      const total = m ? Number(m[1]) : null;
      return {
        status: g.statusCode,
        bytes: total,
        type: String(g.headers['content-type'] || ''),
        via: 'GET' as const
      };
    } catch (e:any) {
      return { status: 0, bytes: null, type: '', via: 'ERR' as const, error: String(e.message||e) };
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, limit = 30 } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });
    const base = new URL(url);
    const r = await got(url, { timeout:{request:15000}, throwHttpErrors:false, followRedirect:true });
    if (r.statusCode >= 400) return new Response(JSON.stringify({ ok:false, error:`${r.statusCode} on page` }), { status:200 });

    const $ = cheerio.load(r.body);
    const images: Array<{ src:string; alt?:string; width?:string; height?:string }> = [];
    $('img[src]').each((_, el)=>{
      const src = String($(el).attr('src')||'').trim();
      if (!src) return;
      images.push({
        src: abs(base, src)!,
        alt: String($(el).attr('alt')||'').trim() || undefined,
        width: String($(el).attr('width')||'').trim() || undefined,
        height: String($(el).attr('height')||'').trim() || undefined
      });
    });

    // dedupe by absolute URL
    const seen = new Set<string>();
    const uniq = images.filter(x => {
      if (seen.has(x.src)) return false; seen.add(x.src); return true;
    }).slice(0, limit);

    const rows: any[] = [];
    for (const it of uniq) {
      const meta = await headOrLightGet(it.src);
      const extMatch = it.src.split('?')[0].toLowerCase().match(/\.(\w{2,5})$/);
      const ext = extMatch ? extMatch[1] : '';
      const type = meta.type || (ext ? `image/${ext}` : '');
      const nextGen = !/avif|webp|jxl/i.test(type) && !/\.avif|\.webp|\.jxl$/i.test(it.src);
      rows.push({
        url: it.src,
        status: meta.status,
        bytes: meta.bytes,
        type,
        suggestedNextGen: nextGen,
        altMissing: !it.alt,
        width: it.width || null,
        height: it.height || null,
        via: meta.via,
        error: (meta as any).error
      });
    }

    // sort heaviest first
    rows.sort((a,b)=> (b.bytes||0) - (a.bytes||0));
    const totalBytes = rows.reduce((s,r)=> s + (r.bytes||0), 0);

    return new Response(JSON.stringify({ ok:true, data: { count: rows.length, totalBytes, rows } }), {
      status:200, headers:{ 'content-type':'application/json' }
    });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
