import { NextRequest } from 'next/server';
import got from 'got';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { url, maxHops = 10 } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });
    let current = url;
    const chain: Array<{ url:string; status?:number; location?:string; final?:boolean; error?:string }> = [];

    for (let i=0; i<maxHops; i++) {
      try {
        const r = await got(current, { method: 'HEAD', throwHttpErrors: false, followRedirect: false, timeout:{ request: 12000 } });
        const status = r.statusCode;
        const loc = r.headers.location as string | undefined;

        chain.push({ url: current, status, location: loc, final: !loc && status < 400 });
        if (loc && /^https?:/i.test(loc)) { current = loc; continue; }
        if (loc) { // relative
          const u = new URL(loc, current).toString();
          current = u; continue;
        }
        break;
      } catch (e:any) {
        chain.push({ url: current, error: String(e.message || e) });
        break;
      }
    }
    return new Response(JSON.stringify({ ok:true, data: { chain } }), { status:200, headers:{ 'content-type':'application/json' } });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
