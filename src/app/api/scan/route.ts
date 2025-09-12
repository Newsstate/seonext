import { NextRequest } from 'next/server';
import got from 'got';
import { parseSEO } from '@/lib/seo';

export const runtime = 'nodejs'; // ensure Node runtime (not edge)

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400 });
    }
    // Basic fetch (static HTML). For JS-heavy sites, consider enabling puppeteer mode below.
    const resp = await got(url, {
      http2: true,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SEOInsight/1.0; +https://example.com)' },
      timeout: { request: 15000 },
      retry: { limit: 1 }
    });
    const html = resp.body;
    const parsed = parseSEO(html, url);
    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err.message||err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

/* OPTIONAL: Dynamic render using puppeteer-core on Vercel
   1) npm i puppeteer-core @sparticuz/chromium
   2) Uncomment and switch to this code path if needed.
   3) Increase function memory/time in vercel.json if pages are heavy.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

async function renderWithChromium(targetUrl: string) {
  const exePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: exePath || undefined,
    headless: chromium.headless
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (compatible; SEOInsight/1.0)');
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 20000 });
  const html = await page.content();
  await browser.close();
  return html;
}
*/
