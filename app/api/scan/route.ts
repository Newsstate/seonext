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
    followRedirect: true
  });
  return r;
}

// Optional headless render (enable with env ENABLE_RENDER=1 and request {render:true})
async function renderHtml(url: string) {
  const { default: chromium } = await import('@sparticuz/chromium');
  const puppeteer = await import('puppeteer-core');
  const exePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: exePath,
    headless: chromium.headless
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; SEOMagic/1.3; +https://example.com)');
    await page.goto(url, { waitUntil: ['load','networkidle2'], timeout: 25000 });
    const html = await page.content();
    const finalUrl = page.url();
    const headers: Record<string,string> = {}; // puppeteer doesn't expose response headers for whole page easily
    return { body: html, url: finalUrl, headers, statusCode: 200 };
  } finally {
    await browser.close();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, render = false } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ ok:false, error: 'Missing url' }), { status: 400 });
    }

    const ua = 'Mozilla/5.0 (compatible; SEOMagic/1.3; +https://example.com)';
    let resp: any;

    if (render && process.env.ENABLE_RENDER === '1') {
      resp = await renderHtml(url);
    } else {
      resp = await fetchHtml(url, ua);
    }

    const parsed = parseSEO(resp.body, url, resp.headers as any, resp.statusCode);
    parsed.finalUrl = resp.url;
    parsed.redirected = parsed.finalUrl !== url;

    // Content stats + thin content check
    const main = extractMainText(resp.body);
    parsed.contentStats = readabilityStats(main.text);
    if (parsed.contentStats.words < 300) {
      parsed._warnings.push(`Low word count (${parsed.contentStats.words}).`);
    }

    // Duplicate / canonical drift check
    if (parsed.canonical && parsed.canonical !== parsed.finalUrl && parsed.canonicalStatus !== 'multiple') {
      try {
        const can = await fetchHtml(parsed.canonical, ua);
        const a = main;
        const bText = extractMainText(can.body);
        const sim = jaccard(a.text, bText.text);
        let risk: 'low'|'medium'|'high' = 'low';
        if (sim >= 0.85) risk = 'high';
        else if (sim >= 0.60) risk = 'medium';
        parsed.duplication = { comparedUrl: can.url, similarity: Number(sim.toFixed(3)), pageWords: a.words, comparedWords: bText.words, risk };
        if (risk === 'high') parsed._warnings.push(`Content near-duplicate with canonical (${sim.toFixed(2)}).`);
        else if (risk === 'medium') parsed._warnings.push(`Content similarity with canonical (${sim.toFixed(2)}).`);
      } catch { /* ignore */ }
    }

    // compute scores last
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
