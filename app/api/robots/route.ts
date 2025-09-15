import { NextRequest } from 'next/server';
import got from 'got';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });
    const u = new URL(url);
    const robotsUrl = `${u.origin}/robots.txt`;
    const r = await got(robotsUrl, { timeout:{ request:15000 }, retry:{ limit:1 }, throwHttpErrors:false });

    const text = r.statusCode >= 400 ? '' : r.body;
    const groups: Array<{ agent:string; allow:string[]; disallow:string[] }> = [];
    const sitemaps: string[] = [];
    let current: { agent:string; allow:string[]; disallow:string[] } | null = null;

    for (const raw of text.split(/\r?\n/)) {
      const line = raw.split('#')[0].trim(); if (!line) continue;
      const [k, ...rest] = line.split(':');
      const v = rest.join(':').trim();
      const key = k.toLowerCase();

      if (key === 'user-agent') {
        current = { agent: v, allow: [], disallow: [] };
        groups.push(current);
      } else if (key === 'allow') {
        if (!current) { current = { agent: '*', allow: [], disallow: [] }; groups.push(current); }
        current.allow.push(v);
      } else if (key === 'disallow') {
        if (!current) { current = { agent: '*', allow: [], disallow: [] }; groups.push(current); }
        current.disallow.push(v);
      } else if (key === 'sitemap') {
        sitemaps.push(v);
      }
    }

    return new Response(JSON.stringify({ ok:true, data: { robotsUrl, groups, sitemaps, raw: text } }), {
      status:200, headers:{ 'content-type':'application/json' }
    });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
