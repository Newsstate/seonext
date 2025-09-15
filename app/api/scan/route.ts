import { NextRequest } from 'next/server';
import got from 'got';
import { parseSEO, extractMainText, readabilityStats, jaccard, scoreFrom } from '@/lib/seo';

export const runtime = 'nodejs';

async function fetchHtml(url: string, ua: string) {
  const r = await got(url, {
    http2: true,
    headers: { 'user-agent': ua },
    timeout: { request: 15000 },
    retry: { limit: 1 },
    followRedirect: true,
  });
  return r;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Missing url' }), { status: 400 });
    }

    const ua = 'Mozilla/5.0 (compatible; SEOMagic/1.3; +https://example.com)';
    const resp = await fetchHtml(url, ua);

    const parsed = parseSEO(resp.body, url, resp.headers as any, resp.statusCode);
    parsed.finalUrl = resp.url;
    parsed.redirected = parsed.finalUrl !== url;

    // content stats
    const main = extractMainText(resp.body);
    parsed.contentStats = readabilityStats(main.text);
    if (parsed.contentStats.words < 300) {
      parsed._warnings.push(`Low word count (${parsed.contentStats.words}).`);
    }

    // duplicate / canonical drift
    if (parsed.canonical && parsed.canonical !== parsed.finalUrl && parsed.canonicalStatus !== 'multiple') {
      try {
        const can = await fetchHtml(parsed.canonical, ua);
        const b = extractMainText(can.body);
        const sim = jaccard(main.text, b.text);
        let risk: 'low' | 'medium' | 'high' = 'low';
        if (sim >= 0.85) risk = 'high';
        else if (sim >= 0.60) risk = 'medium';
        parsed.duplication = {
          comparedUrl: can.url,
          similarity: Number(sim.toFixed(3)),
          pageWords: main.words,
          comparedWords: b.words,
          risk,
        };
        if (risk === 'high') parsed._warnings.push(`Content near-duplicate with canonical (${sim.toFixed(2)}).`);
        else if (risk === 'medium') parsed._warnings.push(`Content similarity with canonical (${sim.toFixed(2)}).`);
      } catch { /* ignore */ }
    }

    // score
    parsed.score = scoreFrom(parsed);

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message || err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
