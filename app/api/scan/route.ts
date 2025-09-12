import { NextRequest } from 'next/server';
import got from 'got';
import { parseSEO } from '@/lib/seo';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ ok:false, error: 'Missing url' }), { status: 400 });
    }
    const resp = await got(url, {
      http2: true,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SEOMagic/1.0; +https://example.com)' },
      timeout: { request: 15000 },
      retry: { limit: 1 }
    });
    const html = resp.body;
    const parsed = parseSEO(html, url);
    parsed.finalUrl = resp.url;
    return new Response(JSON.stringify({ ok:true, data: parsed }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err:any) {
    return new Response(JSON.stringify({ ok:false, error: String(err.message||err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
