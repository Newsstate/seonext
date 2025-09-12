import { NextRequest } from 'next/server';
import got from 'got';
export const runtime = 'nodejs';

function variants(u: URL) {
  const host = u.hostname.replace(/^www\./i,'');
  return [
    new URL(u.pathname + u.search, `http://${host}`),
    new URL(u.pathname + u.search, `https://${host}`),
    new URL(u.pathname + u.search, `http://www.${host}`),
    new URL(u.pathname + u.search, `https://www.${host}`)
  ];
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    const base = new URL(url);
    const list = variants(base);
    const ua = 'Mozilla/5.0 (compatible; SEOMagic/1.3; +https://example.com)';
    const out = [];
    for (const v of list) {
      try {
        const r = await got(v.toString(), { followRedirect: true, throwHttpErrors:false, timeout:{request:12000}, headers:{'user-agent':ua} });
        out.push({ input: v.toString(), status: r.statusCode, finalUrl: r.url });
      } catch(e:any) {
        out.push({ input: v.toString(), error: String(e.message||e) });
      }
    }
    return new Response(JSON.stringify({ ok:true, data: out }), { status:200, headers:{'content-type':'application/json'} });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:400 });
  }
}
