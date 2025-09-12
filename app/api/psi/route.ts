import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

/**
 * Server-side proxy to Google PageSpeed Insights (optional).
 * Requires env var PAGESPEED_API_KEY in Vercel project settings.
 */
export async function POST(req: NextRequest) {
  try {
    const { url, strategy = 'mobile' } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });
    const key = process.env.PAGESPEED_API_KEY;
    if (!key) return new Response(JSON.stringify({ ok:false, error:'PAGESPEED_API_KEY not set' }), { status:500 });
    const qs = new URLSearchParams({ url, strategy, key });
    const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs.toString()}`, { cache: 'no-store' });
    const data = await r.json();
    return new Response(JSON.stringify({ ok:true, data }), { status:200, headers: { 'content-type':'application/json' } });
  } catch (e:any){
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
