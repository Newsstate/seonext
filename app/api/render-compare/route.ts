// app/api/render-compare/route.ts
import { NextRequest, NextResponse } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { parseSEO, extractMainText, jaccard } from '@/lib/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type DiffRow = { key: string; a: any; b: any; same: boolean };

const norm = (s?: string | null) => (s || '').trim();
const domSize = (html: string) => cheerio.load(html)('*').length;
const cap = <T,>(arr: T[], n = 200) => (arr.length > n ? arr.slice(0, n) : arr);

const unique = <T,>(arr: T[]) => Array.from(new Set(arr));
const setOf = (arr?: string[]) => new Set((arr || []).map(String));

const deltaSets = (A: Set<string>, B: Set<string>) => {
  const added: string[] = [];
  const removed: string[] = [];
  for (const x of B) if (!A.has(x)) added.push(x);
  for (const x of A) if (!B.has(x)) removed.push(x);
  return { added, removed };
};

const sameSet = (a?: string[], b?: string[]) => {
  const A = setOf(a), B = setOf(b);
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
};

const normalizeUrl = (href: string, baseUrl: string) => {
  try {
    const u = new URL(href, baseUrl);
    u.hash = ''; // ignore fragments
    // Normalize trailing slash except for root
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    // Lowercase host
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return '';
  }
};

const sameHost = (a: string, b: string) => {
  try {
    const A = new URL(a);
    const B = new URL(b);
    const stripWww = (h: string) => h.replace(/^www\./i, '').toLowerCase();
    return stripWww(A.hostname) === stripWww(B.hostname);
  } catch {
    return false;
  }
};

function extractLinks(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const baseHref = $('base[href]').attr('href');
  const absBase = baseHref ? new URL(baseHref, baseUrl).toString() : baseUrl;

  const all = new Set<string>();
  const internal = new Set<string>();
  const external = new Set<string>();
  const nofollow = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = String($(el).attr('href') || '').trim();
    const rel = String($(el).attr('rel') || '').toLowerCase();
    const abs = normalizeUrl(href, absBase);
    if (!abs) return;
    all.add(abs);
    if (sameHost(abs, absBase)) internal.add(abs); else external.add(abs);
    if (/\bnofollow\b/.test(rel)) nofollow.add(abs);
  });

  return { all, internal, external, nofollow };
}

function extractImagesMissingAlt(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const res = new Set<string>();
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    const src = String($(el).attr('src') || '').trim();
    if (alt && alt.trim() !== '') return;
    const abs = normalizeUrl(src, baseUrl);
    if (abs) res.add(abs);
  });
  return res;
}

function extractHeadings(html: string) {
  const $ = cheerio.load(html);
  const by = (sel: string) =>
    $('body').find(sel).map((_, el) => norm($(el).text())).get()
      .filter(Boolean)
      .map(t => t.replace(/\s+/g, ' ')); // collapse spaces
  return {
    h1: unique(by('h1')),
    h2: unique(by('h2')),
    h3: unique(by('h3')),
  };
}

/** ---------- Chromium launcher (Vercel friendly) ---------- */
function firstExisting(paths: string[]) {
  for (const p of paths) try { if (p && fs.existsSync(p)) return p; } catch {}
  return undefined;
}

async function launchBrowser() {
  // Nudge chromium package to use lambda settings reliably on Vercel
  if (!process.env.AWS_LAMBDA_JS_RUNTIME) process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs20.x';

  const execPath = await chromium.executablePath();   // usually /tmp/chromium on Vercel
  const execDir = execPath ? path.dirname(execPath) : '/tmp';

  // Locations bundled via vercel.json includeFiles
  const pkgRoot1 = path.join(process.cwd(), 'node_modules', '@sparticuz', 'chromium');
  const pkgRoot2 = '/var/task/node_modules/@sparticuz/chromium';
  const libDir   = firstExisting([path.join(pkgRoot1, 'lib'), path.join(pkgRoot2, 'lib')]);
  const fontsDir = firstExisting([path.join(pkgRoot1, 'fonts'), path.join(pkgRoot2, 'fonts')]);

  // Make loader see native libs (fixes libnss3.so)
  const ld = unique<string>([
    libDir || '',
    execDir,
    process.env.LD_LIBRARY_PATH || '',
    '/usr/lib64', '/usr/lib', '/lib64', '/lib',
  ]).filter(Boolean);
  process.env.LD_LIBRARY_PATH = ld.join(':');
  if (fontsDir && !process.env.FONTCONFIG_PATH) process.env.FONTCONFIG_PATH = fontsDir;
  if (!process.env.TMPDIR) process.env.TMPDIR = '/tmp';

  // Headless "shell" tends to be most reliable with @sparticuz/chromium
  const headlessType: 'shell' = 'shell';
  const args = puppeteer.defaultArgs({ args: chromium.args, headless: headlessType });

  return puppeteer.launch({
    args,
    defaultViewport: chromium.defaultViewport,
    executablePath: execPath,
    headless: headlessType,
    ignoreHTTPSErrors: true,
  });
}
/** --------------------------------------------------------- */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      url,
      waitUntil = 'networkidle2',
      renderTimeoutMs = 25000,
    }: {
      url: string;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
      renderTimeoutMs?: number;
    } = body || {};

    if (!url) {
      return NextResponse.json({ ok: false, error: 'Missing url' }, { status: 400 });
    }

    /** ---------- No-JS fetch ---------- */
    const baseResp = await got(url, {
      followRedirect: true,
      throwHttpErrors: false,
      timeout: { request: 20000 },
      headers: {
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

    const noJsUrl   = baseResp.url;
    const noJsHtml  = baseResp.body;
    const noJsSEO   = parseSEO(noJsHtml, noJsUrl, baseResp.headers as any, baseResp.statusCode);
    const noJsMain  = extractMainText(noJsHtml);
    const noJsText  = noJsMain.text;
    const noJsDom   = domSize(noJsHtml);
    const noJsWords = noJsSEO.contentStats?.words ?? noJsMain.words;

    /** ---------- JS-rendered fetch ---------- */
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36'
      );

      const resp = await page.goto(url, { waitUntil, timeout: renderTimeoutMs });
      await new Promise((r) => setTimeout(r, 300));

      const renderedHtml    = await page.content();
      const renderedUrl     = page.url();
      const renderedStatus  = resp?.status();
      const renderedHeaders = resp ? resp.headers() : {};
      const renderedSEO     = parseSEO(renderedHtml, renderedUrl, renderedHeaders as any, renderedStatus);
      const renderedMain    = extractMainText(renderedHtml);
      const renderedText    = renderedMain.text;
      const renderedDom     = domSize(renderedHtml);
      const renderedWords   = renderedSEO.contentStats?.words ?? renderedMain.words;

      /** ---------- High-level diffs ---------- */
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

      // Headings (counts)
      push('h1Count', noJsSEO.h1Count, renderedSEO.h1Count);
      push('headings.h2', noJsSEO.headings?.h2 ?? 0, renderedSEO.headings?.h2 ?? 0);
      push('headings.h3', noJsSEO.headings?.h3 ?? 0, renderedSEO.headings?.h3 ?? 0);

      // Links / Images (counts)
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

      // Hreflang compare by lang:href
      const mapList = (m?: Array<{ lang: string; href: string }>) => (m || []).map(x => `${x.lang}:${x.href}`);
      push('hreflang.map', mapList(noJsSEO.hreflangMap), mapList(renderedSEO.hreflangMap), sameSet);

      // Content stats + similarity
      push('content.words', noJsWords, renderedWords);
      const textSimilarity = Number(jaccard(noJsText, renderedText).toFixed(3));
      const keyChanges = diffs.filter(d => !d.same);

      /** ---------- Expanded granular diffs (elements/values/links) ---------- */
      // Build granular maps from raw HTML for both versions
      const noLinks        = extractLinks(noJsHtml, noJsUrl);
      const renderedLinks  = extractLinks(renderedHtml, renderedUrl);

      const noImgsMissing  = extractImagesMissingAlt(noJsHtml, noJsUrl);
      const renImgsMissing = extractImagesMissingAlt(renderedHtml, renderedUrl);

      const noHeads        = extractHeadings(noJsHtml);
      const renHeads       = extractHeadings(renderedHtml);

      // Link deltas
      const allDelta       = deltaSets(noLinks.all,       renderedLinks.all);
      const internalDelta  = deltaSets(noLinks.internal,  renderedLinks.internal);
      const externalDelta  = deltaSets(noLinks.external,  renderedLinks.external);
      const nofollowDelta  = deltaSets(noLinks.nofollow,  renderedLinks.nofollow);

      // Images missing alt deltas
      const imgAltDelta    = deltaSets(noImgsMissing, renImgsMissing);

      // Headings deltas (by text content)
      const h1Delta        = deltaSets(new Set(noHeads.h1), new Set(renHeads.h1));
      const h2Delta        = deltaSets(new Set(noHeads.h2), new Set(renHeads.h2));
      const h3Delta        = deltaSets(new Set(noHeads.h3), new Set(renHeads.h3));

      // Schema types / Hreflang deltas
      const schemaDelta    = deltaSets(setOf(noJsSEO.schemaTypes || []), setOf(renderedSEO.schemaTypes || []));
      const hreflangDelta  = deltaSets(setOf(mapList(noJsSEO.hreflangMap)), setOf(mapList(renderedSEO.hreflangMap)));

      const diffsExpanded = {
        links: {
          added:            cap(allDelta.added),
          removed:          cap(allDelta.removed),
          addedInternal:    cap(internalDelta.added),
          removedInternal:  cap(internalDelta.removed),
          addedExternal:    cap(externalDelta.added),
          removedExternal:  cap(externalDelta.removed),
          addedNofollow:    cap(nofollowDelta.added),
          removedNofollow:  cap(nofollowDelta.removed),
          counts: {
            noJs: {
              all: noLinks.all.size, internal: noLinks.internal.size,
              external: noLinks.external.size, nofollow: noLinks.nofollow.size
            },
            rendered: {
              all: renderedLinks.all.size, internal: renderedLinks.internal.size,
              external: renderedLinks.external.size, nofollow: renderedLinks.nofollow.size
            }
          }
        },
        imagesMissingAlt: {
          added:  cap(imgAltDelta.added),
          removed: cap(imgAltDelta.removed),
          counts: { noJs: noImgsMissing.size, rendered: renImgsMissing.size }
        },
        headings: {
          h1: { added: cap(h1Delta.added), removed: cap(h1Delta.removed) },
          h2: { added: cap(h2Delta.added), removed: cap(h2Delta.removed) },
          h3: { added: cap(h3Delta.added), removed: cap(h3Delta.removed) },
          counts: {
            noJs: { h1: noHeads.h1.length, h2: noHeads.h2.length, h3: noHeads.h3.length },
            rendered: { h1: renHeads.h1.length, h2: renHeads.h2.length, h3: renHeads.h3.length }
          }
        },
        schemaTypes: {
          added: cap(schemaDelta.added),
          removed: cap(schemaDelta.removed),
          counts: { noJs: noJsSEO.schemaTypes?.length || 0, rendered: renderedSEO.schemaTypes?.length || 0 }
        },
        hreflang: {
          added: cap(hreflangDelta.added),
          removed: cap(hreflangDelta.removed),
          counts: { noJs: noJsSEO.hreflangMap?.length || 0, rendered: renderedSEO.hreflangMap?.length || 0 }
        }
      };

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
            hasGranularChanges:
              allDelta.added.length || allDelta.removed.length ||
              imgAltDelta.added.length || imgAltDelta.removed.length ||
              h1Delta.added.length || h1Delta.removed.length ||
              h2Delta.added.length || h2Delta.removed.length ||
              h3Delta.added.length || h3Delta.removed.length ||
              schemaDelta.added.length || schemaDelta.removed.length ||
              hreflangDelta.added.length || hreflangDelta.removed.length ? true : false
          },
          diffs,               // high-level (unchanged)
          diffsExpanded        // NEW: granular element/value/link differences
        }
      }, { headers: { 'cache-control': 'no-store' } });

    } finally {
      await browser.close().catch(() => {});
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
