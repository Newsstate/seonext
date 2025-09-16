// app/api/render-compare/route.ts
import { NextRequest, NextResponse } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { parseSEO, extractMainText, jaccard } from '@/lib/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type DiffRow = { key: string; a: any; b: any; same: boolean };

const norm = (s?: string | null) => (s || '').trim();
const asSet = (arr?: string[]) => new Set((arr || []).map(String));
const sameSet = (a?: string[], b?: string[]) => {
  const A = asSet(a), B = asSet(b);
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
};
const domSize = (html: string) => cheerio.load(html)('*').length;

function isServerless() {
  return !!(process.env.AWS_REGION || process.env.VERCEL);
}

async function launchBrowser() {
  if (isServerless()) {
    // Lambda/Vercel: use Sparticuz Chromium
    const executablePath = await chromium.executablePath();
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless ?? true,
      ignoreHTTPSErrors: true,
    });
  }

  // Local dev fallbacks
  const envPath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath) {
    return puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: envPath,
      headless: true,
    });
  }

  try {
    // If you keep full "puppeteer" for dev, prefer its bundled Chromium
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const p = await import('puppeteer'); // optional dev dependency
    const devExec = p.executablePath();
    return puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: devExec,
      headless: true,
    });
  } catch {
    throw new Error(
      'No Chromium found for local dev. Set CHROME_PATH or add "puppeteer" (dev) to use its bundled browser.'
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      url,
      waitUntil = 'networkidle2',
      renderTimeoutMs = 25000,
    } = (await req.json()) as {
      url: string;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
      renderTimeoutMs?: number;
    };

    if (!url) {
      return NextResponse.json({ ok: false, error: 'Missing url' }, { status: 400 });
    }

    // ---- No-JS fetch (origin HTML) ----
    const baseResp = await got(url, {
      followRedirect: true,
      throwHttpErrors: false,
      timeout: { request: 20000 },
      headers: {
        // keep it close to a real browser; helps some origins
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
    });

    if (baseResp.statusCode >= 400) {
      return NextResponse.json(
        { ok: false, error: `Source returned ${baseResp.statusCode}` },
        { status: 200 }
      );
    }

    const noJsUrl = baseResp.url;
    const noJsHtml = baseResp.body;
    const noJsSEO = parseSEO(noJsHtml, noJsUrl, baseResp.headers as any, baseResp.statusCode);
    const noJsMain = extractMainText(noJsHtml);
    const noJsText = noJsMain.text;
    const noJsDom = domSize(noJsHtml);
    const noJsWords = noJsSEO.contentStats?.words ?? noJsMain.words;

    // ---- JS-rendered HTML (headless) ----
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();

      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36'
      );

      const resp = await page.goto(url, { waitUntil, timeout: renderTimeoutMs });

      // tiny settle to allow lazy scripts/mutations
      await new Promise((res) => setTimeout(res, 300));

      const renderedHtml = await page.content();
      const renderedUrl = page.url();
      const renderedStatus = resp?.status();
      const renderedHeaders = resp ? resp.headers() : {};

      const renderedSEO = parseSEO(
        renderedHtml,
        renderedUrl,
        renderedHeaders as any,
        renderedStatus
      );
      const renderedMain = extractMainText(renderedHtml);
      const renderedText = renderedMain.text;
      const renderedDom = domSize(renderedHtml);
      const renderedWords = renderedSEO.contentStats?.words ?? renderedMain.words;

      // ---- Diffs ----
      const diffs: DiffRow[] = [];
      const push = (key: string, a: any, b: any, cmp?: (a: any, b: any) => boolean) => {
        const same = cmp ? cmp(a, b) : JSON.stringify(a) === JSON.stringify(b);
        diffs.push({ key, a, b, same });
      };

      // Meta/basics
      push('title', noJsSEO.title, renderedSEO.title);
      push('metaDescription', noJsSEO.metaDescription, renderedSEO.metaDescription);
      push('canonical', noJsSEO.canonical, renderedSEO.canonical);
      push('robotsMeta.raw', noJsSEO.robotsMeta?.raw ?? null, renderedSEO.robotsMeta?.raw ?? null);
      push('robotsMeta.index', noJsSEO.robotsMeta?.index ?? null, renderedSEO.robotsMeta?.index ?? null);
      push('robotsMeta.follow', noJsSEO.robotsMeta?.follow ?? null, renderedSEO.robotsMeta?.follow ?? null);
      push('viewport', noJsSEO.viewport, renderedSEO.viewport);
      push('lang', noJsSEO.lang, renderedSEO.lang);

      // Headings
      push('h1Count', noJsSEO.h1Count, renderedSEO.h1Count);
      push('headings.h2', noJsSEO.headings?.h2 ?? 0, renderedSEO.headings?.h2 ?? 0);
      push('headings.h3', noJsSEO.headings?.h3 ?? 0, renderedSEO.headings?.h3 ?? 0);

      // Links / Images
      push('links.total', noJsSEO.links.total, renderedSEO.links.total);
      push('links.internal', noJsSEO.links.internal, renderedSEO.links.internal);
      push('links.external', noJsSEO.links.external, renderedSEO.links.external);
      push('links.nofollow', noJsSEO.links.nofollow, renderedSEO.links.nofollow);
      push('images.missingAlt', noJsSEO.images?.missingAlt ?? 0, renderedSEO.images?.missingAlt ?? 0);

      // Social
      push('og:title', norm(noJsSEO.og['og:title']), norm(renderedSEO.og['og:title']));
      push('og:description', norm(noJsSEO.og['og:description']), norm(renderedSEO.og['og:description']));
      push('twitter:card', norm(noJsSEO.twitter['twitter:card']), norm(renderedSEO.twitter['twitter:card']));

      // Structured data
      push('schemaTypes', noJsSEO.schemaTypes, renderedSEO.schemaTypes, sameSet);

      // HTTP
      push('http.status', noJsSEO.http?.status ?? baseResp.statusCode, renderedSEO.http?.status ?? renderedStatus ?? null);
      push('http.contentType', noJsSEO.http?.contentType ?? null, renderedSEO.http?.contentType ?? null);
      push('http.xRobotsTag', noJsSEO.http?.xRobotsTag ?? null, renderedSEO.http?.xRobotsTag ?? null);

      // Hreflang (compare by lang:href)
      const mapList = (m?: Array<{ lang: string; href: string }>) => (m || []).map(x => `${x.lang}:${x.href}`);
      push('hreflang.map', mapList(noJsSEO.hreflangMap), mapList(renderedSEO.hreflangMap), sameSet);

      // Content stats + similarity
      push('content.words', noJsWords, renderedWords);
      const textSimilarity = Number(jaccard(noJsText, renderedText).toFixed(3));
      const keyChanges = diffs.filter(d => !d.same);

      return NextResponse.json({
        ok: true,
        data: {
          noJs:     { url: noJsUrl,     status: noJsSEO.http?.status ?? baseResp.statusCode, domSize: noJsDom,     words: noJsWords },
          rendered: { url: renderedUrl, status: renderedSEO.http?.status ?? renderedStatus ?? null, domSize: renderedDom, words: renderedWords },
          summary:  {
            textSimilarity,
            domDelta:   renderedDom - noJsDom,
            wordsDelta: renderedWords - noJsWords,
            keyChangesCount: keyChanges.length,
          },
          diffs,
        }
      }, { headers: { 'cache-control': 'no-store' } });
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
