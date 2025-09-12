import { NextRequest } from 'next/server';
import got from 'got';
import { parseSEO, extractMainText, jaccard, scoreFrom } from '@/lib/seo';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ ok:false, error: 'Missing url' }), { status: 400 });
    }

    const ua = 'Mozilla/5.0 (compatible; SEOMagic/1.3; +https://example.com)';
    const resp = await got(url, {
      http2: true,
      headers: { 'user-agent': ua },
      timeout: { request: 15000 },
      retry: { limit: 1 },
      followRedirect: true
    });

    const parsed = parseSEO(resp.body, url, resp.headers as any, resp.statusCode);
    parsed.finalUrl = resp.url;
    parsed.redirected = parsed.finalUrl !== url;

    // Duplicate / canonical drift check (lightweight)
    if (parsed.canonical && parsed.canonical !== parsed.finalUrl && parsed.canonicalStatus !== 'multiple') {
      try {
        const can = await got(parsed.canonical, {
          http2: true, headers: { 'user-agent': ua }, timeout: { request: 12000 }, retry: { limit: 0 }, followRedirect: true
        });
        const a = extractMainText(resp.body);
        const b = extractMainText(can.body);
        const sim = jaccard(a.text, b.text);
        let risk: 'low'|'medium'|'high' = 'low';
        if (sim >= 0.85) risk = 'high';
        else if (sim >= 0.60) risk = 'medium';
        parsed.duplication = { comparedUrl: can.url, similarity: Number(sim.toFixed(3)), pageWords: a.words, comparedWords: b.words, risk };
        if (risk === 'high') parsed._warnings.push(`Content near-duplicate with canonical (${sim.toFixed(2)}).`);
        else if (risk === 'medium') parsed._warnings.push(`Content similarity with canonical (${sim.toFixed(2)}).`);
      } catch {/* ignore duplicate fetch errors */}
    }

    // compute scores last (includes duplication signal if present)
    parsed.score = scoreFrom(parsed);

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
