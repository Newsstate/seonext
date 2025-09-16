// app/api/cwv/route.ts
import { NextRequest } from 'next/server';
import got from 'got';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type CruxMetricId =
  | 'LARGEST_CONTENTFUL_PAINT_MS'
  | 'CUMULATIVE_LAYOUT_SHIFT_SCORE'
  | 'INTERACTION_TO_NEXT_PAINT';

function parseCruxMetrics(loadingExperience: any) {
  const out: Record<string, { percentile: number; category: string }> = {};
  const m = loadingExperience?.metrics || {};
  for (const id of Object.keys(m || {})) {
    const entry = m[id];
    if (!entry) continue;
    const category = entry.category; // FAST | AVERAGE | SLOW
    let percentile = Number(entry.percentile ?? NaN);

    // Normalize units
    if (id === 'CUMULATIVE_LAYOUT_SHIFT_SCORE') {
      // CLS percentile comes as *100; convert to score (e.g., 12 -> 0.12)
      percentile = percentile / 100;
    } else {
      // LCP/INP are ms. Keep ms; also provide seconds in UI if you like.
    }

    out[id] = { percentile, category };
  }
  return out;
}

async function fetchPSI(url: string, strategy: 'mobile' | 'desktop') {
  const key = process.env.GOOGLE_PSI_KEY; // optional
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', strategy);
  endpoint.searchParams.set('category', 'PERFORMANCE');
  if (key) endpoint.searchParams.set('key', key);

  const res = await got(endpoint.toString(), { timeout: { request: 20000 } }).json<any>();
  const le = res.loadingExperience || res.originLoadingExperience || null;

  return {
    strategy,
    loadingExperience: parseCruxMetrics(le),
    lighthousePerfScore: res.lighthouseResult?.categories?.performance?.score ?? null, // 0..1 (lab)
  };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url: string };
    if (!url) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing url' }), { status: 400 });
    }

    const [mobile, desktop] = await Promise.all([
      fetchPSI(url, 'mobile'),
      fetchPSI(url, 'desktop'),
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        data: { mobile, desktop },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), {
      status: 500,
    });
  }
}
