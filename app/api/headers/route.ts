import { NextRequest } from 'next/server';
import got from 'got';

export const runtime = 'nodejs';

function parseMaxAge(v?: string) {
  if (!v) return null;
  const m = v.match(/(?:s-maxage|max-age)\s*=\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });

    const r = await got(url, { method:'GET', throwHttpErrors:false, timeout:{ request:15000 }, followRedirect:true });

    const h = r.headers;
    const cc = String(h['cache-control'] || '');
    const enc = String(h['content-encoding'] || '');
    const ttl = parseMaxAge(cc);
    const isCompressed = /br|gzip|deflate/i.test(enc);
    const ct = String(h['content-type'] || '');
    const vary = String(h['vary'] || '');
    const etag = String(h['etag'] || '');
    const lm = String(h['last-modified'] || '');
    const server = String(h['server'] || '');
    const powered = String(h['x-powered-by'] || '');

    const notes: string[] = [];
    if (!isCompressed && /text|json|javascript|xml|svg|font/i.test(ct)) notes.push('Compression (gzip/br) not detected.');
    if (ttl === null) notes.push('Cache-Control max-age not set.');
    if (!etag && !lm) notes.push('No ETag/Last-Modified validators.');
    if (/text\/html/i.test(ct) && ttl && ttl > 60) notes.push('HTML cached with long TTL (check if intended).');

    return new Response(JSON.stringify({
      ok:true,
      data: {
        status: r.statusCode,
        finalUrl: r.url,
        contentType: ct,
        cacheControl: cc || null,
        maxAge: ttl,
        contentEncoding: enc || null,
        compressed: isCompressed,
        vary: vary || null,
        etag: etag || null,
        lastModified: lm || null,
        server: server || null,
        xPoweredBy: powered || null,
        notes
      }
    }), { status:200, headers:{ 'content-type':'application/json' } });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
