import { NextRequest } from 'next/server';
import got from 'got';
export const runtime = 'nodejs';

function parseRobots(base: string, txt: string) {
  const lines = txt.split(/\r?\n/);
  let active = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  for (const raw of lines) {
    const line = raw.split('#')[0].trim(); if (!line) continue;
    const [k, ...rest] = line.split(':'); const v = rest.join(':').trim();
    const key = k.toLowerCase();
    if (key === 'user-agent') active = (v === '*');
    if (!active) continue;
    if (key === 'disallow') disallow.push(v || '/');
    if (key === 'allow') allow.push(v);
  }
  return { allow, disallow };
}
function matches(path: string, rule: string) {
  if (rule === '') return false;
  if (rule === '/') return true;
  // simple prefix match
  return path.startsWith(rule);
}
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    const u = new URL(url);
    const robotsUrl = `${u.origin}/robots.txt`;
    const r = await got(robotsUrl, { timeout:{request:12000}, retry:{limit:1} });
    const { allow, disallow } = parseRobots(u.origin, r.body);
    const path = u.pathname + (u.search||'');
    const blocked = disallow.some(rule => matches(path, rule)) && !allow.some(rule => matches(path, rule));
    return new Response(JSON.stringify({ ok:true, data: { robotsUrl, blocked, allow, disallow, path } }), { status:200, headers:{'content-type':'application/json'} });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500, headers:{'content-type':'application/json'} });
  }
}
