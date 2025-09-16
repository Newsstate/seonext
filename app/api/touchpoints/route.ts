// app/api/touchpoints/route.ts
import { NextRequest } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { parseSEO } from '@/lib/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type HreflangBackref = { lang: string; href: string; ok: boolean };
type Conflict = string;

type InlinkReferrer = {
  url: string;
  anchor: string;
  nofollow: boolean;
};

type AssetInfo = {
  url: string;
  type: 'script' | 'style' | 'image' | 'font' | 'media' | 'preload' | 'other';
  status?: number;
  contentType?: string | null;
  bytes?: number | null;            // content-length (may be null if unknown)
  thirdParty: boolean;
  blocking?: boolean;               // render-blocking hint (stylesheets & head scripts without async/defer)
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36';

const norm = (u: string) => {
  try {
    const x = new URL(u);
    x.host = x.host.toLowerCase();
    if (x.pathname !== '/' && x.pathname.endsWith('/')) x.pathname = x.pathname.slice(0, -1);
    if (x.port === '80' && x.protocol === 'http:') x.port = '';
    if (x.port === '443' && x.protocol === 'https:') x.port = '';
    x.hash = '';
    return x.toString();
  } catch { return u; }
};

async function fetchHtml(u: string) {
  const r = await got(u, {
    followRedirect: true,
    throwHttpErrors: false,
    timeout: { request: 20000 },
    headers: { 'user-agent': UA, accept: 'text/html,*/*' },
  });
  return { finalUrl: r.url, status: r.statusCode, headers: r.headers as Record<string, string>, body: r.body };
}

function parseRobotsForStarAgent(txt: string) {
  const lines = (txt || '').split('\n').map(l => l.trim());
  const blocks: { agent: string; rules: Array<{ type: 'allow' | 'disallow'; path: string }> }[] = [];
  let cur: any = null;
  const sitemaps: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    if (k === 'user-agent') {
      cur = { agent: v.toLowerCase(), rules: [] as any[] };
      blocks.push(cur);
    } else if (k === 'allow' && cur) {
      cur.rules.push({ type: 'allow', path: v });
    } else if (k === 'disallow' && cur) {
      cur.rules.push({ type: 'disallow', path: v });
    } else if (k === 'sitemap') {
      sitemaps.push(v);
    }
  }
  const star = blocks.filter(b => b.agent === '*' || b.agent.includes('*')).flatMap(b => b.rules);
  return { sitemaps, rules: star as Array<{ type: 'allow' | 'disallow'; path: string }> };
}

function robotsMatch(pathname: string, rules: Array<{ type: 'allow' | 'disallow'; path: string }>) {
  let match: { type: 'allow' | 'disallow'; path: string } | null = null;
  for (const r of rules) {
    if (!r.path) continue;
    const p = r.path.replace(/\*/g, '.*');
    const re = new RegExp('^' + p);
    if (re.test(pathname)) {
      if (!match || r.path.length > match.path.length) match = r;
    }
  }
  return match;
}

function discoverLikelySitemaps(origin: string) {
  return [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ];
}

async function checkSitemapsForUrl(sitemapUrls: string[], targetUrl: string, limit = 5) {
  const out: { tested: number; found: boolean; sample?: string } = { tested: 0, found: false };
  const N = Math.min(limit, sitemapUrls.length);
  for (let i = 0; i < N; i++) {
    const sm = sitemapUrls[i];
    try {
      const r = await got(sm, { timeout: { request: 20000 }, headers: { 'user-agent': UA } });
      out.tested++;
      const xml = parser.parse(r.body);
      if (xml.sitemapindex?.sitemap) {
        const kids = (Array.isArray(xml.sitemapindex.sitemap) ? xml.sitemapindex.sitemap : [xml.sitemapindex.sitemap])
          .map((s: any) => s.loc).filter(Boolean);
        for (const child of kids.slice(0, 5)) {
          try {
            const rr = await got(child, { timeout: { request: 20000 }, headers: { 'user-agent': UA } });
            const xx = parser.parse(rr.body);
            const urls = (Array.isArray(xx.urlset?.url) ? xx.urlset.url : (xx.urlset?.url ? [xx.urlset.url] : []))
              .map((u: any) => u.loc).filter(Boolean);
            if (urls.some((u: string) => norm(u) === norm(targetUrl))) {
              out.found = true; out.sample = child; return out;
            }
          } catch {}
        }
      } else if (xml.urlset?.url) {
        const urls = (Array.isArray(xml.urlset.url) ? xml.urlset.url : [xml.urlset.url])
          .map((u: any) => u.loc).filter(Boolean);
        if (urls.some((u: string) => norm(u) === norm(targetUrl))) {
          out.found = true; out.sample = sm; return out;
        }
      }
    } catch {}
  }
  return out;
}

/** Collect internal URLs from sitemaps (origin-only), up to limits */
async function collectSitemapUrls(sitemapUrls: string[], origin: string, maxFiles = 5, maxUrls = 150) {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (u: string) => {
    try {
      const a = new URL(u);
      if (a.origin === origin) {
        const n = norm(a.toString());
        if (!seen.has(n)) { seen.add(n); out.push(n); }
      }
    } catch {}
  };

  const N = Math.min(maxFiles, sitemapUrls.length);
  for (let i = 0; i < N && out.length < maxUrls; i++) {
    const sm = sitemapUrls[i];
    try {
      const r = await got(sm, { timeout: { request: 20000 }, headers: { 'user-agent': UA } });
      const xml = parser.parse(r.body);
      if (xml.sitemapindex?.sitemap) {
        const kids = (Array.isArray(xml.sitemapindex.sitemap) ? xml.sitemapindex.sitemap : [xml.sitemapindex.sitemap])
          .map((s: any) => s.loc).filter(Boolean).slice(0, 8);
        for (const child of kids) {
          try {
            const rr = await got(child, { timeout: { request: 20000 }, headers: { 'user-agent': UA } });
            const xx = parser.parse(rr.body);
            const urls = (Array.isArray(xx.urlset?.url) ? xx.urlset.url : (xx.urlset?.url ? [xx.urlset.url] : []))
              .map((u: any) => u.loc).filter(Boolean);
            for (const u of urls) { add(u); if (out.length >= maxUrls) break; }
            if (out.length >= maxUrls) break;
          } catch {}
        }
      } else if (xml.urlset?.url) {
        const urls = (Array.isArray(xml.urlset.url) ? xml.urlset.url : [xml.urlset.url])
          .map((u: any) => u.loc).filter(Boolean);
        for (const u of urls) { add(u); if (out.length >= maxUrls) break; }
      }
    } catch {}
  }
  return out;
}

/** Scan a list of pages for anchor inlinks to target */
async function findInternalReferrers(candidates: string[], target: string, sample = 40): Promise<{searched:number; found:InlinkReferrer[]}> {
  const pick = candidates.slice(0, sample);
  const found: InlinkReferrer[] = [];
  let searched = 0;

  for (const u of pick) {
    try {
      if (norm(u) === norm(target)) continue;
      const r = await fetchHtml(u);
      searched++;
      const $ = cheerio.load(r.body);
      let hitRecorded = false;
      $('a[href]').each((_, el) => {
        if (hitRecorded) return;
        const href = String($(el).attr('href') || '').trim();
        if (!href) return;
        try {
          const abs = new URL(href, r.finalUrl).toString();
          if (norm(abs) === norm(target)) {
            const rel = String($(el).attr('rel') || '').toLowerCase();
            const nofollow = /\bnofollow\b/.test(rel);
            const anchor = $(el).text().trim().replace(/\s+/g, ' ').slice(0, 160);
            found.push({ url: r.finalUrl, anchor, nofollow });
            hitRecorded = true;
          }
        } catch {}
      });
    } catch {
      searched++;
    }
  }
  return { searched, found };
}

/** NEW: extract all <a> links from a page */
function extractAllLinks($: cheerio.CheerioAPI, baseUrl: string, max = 1000) {
  const seen = new Set<string>();
  const out: string[] = [];
  $('a[href]').each((_, el)=>{
    const href = String($(el).attr('href') || '').trim();
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      const n = norm(abs);
      if (!seen.has(n)) {
        seen.add(n);
        out.push(n);
        if (out.length >= max) return false as any;
      }
    } catch {}
  });
  return out;
}

/** NEW: gather assets from HTML */
function gatherAssets($: cheerio.CheerioAPI, baseUrl: string) {
  const base = new URL(baseUrl);
  const assets: AssetInfo[] = [];
  const push = (url: string, type: AssetInfo['type'], third: boolean, blocking?: boolean) => {
    assets.push({ url, type, thirdParty: third, blocking });
  };

  // Stylesheets
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = String($(el).attr('href') || '').trim(); if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      push(abs, 'style', new URL(abs).origin !== base.origin, true);
    } catch {}
  });

  // Preload hints
  $('link[rel="preload"][href]').each((_, el) => {
    const href = String($(el).attr('href') || '').trim(); if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      push(abs, 'preload', new URL(abs).origin !== base.origin, false);
    } catch {}
  });

  // Scripts (mark head scripts without async/defer as blocking)
  const headScriptSet = new Set<any>();
  $('head script[src]').each((_, el) => { headScriptSet.add(el); });
  $('script[src]').each((_, el) => {
    const src = String($(el).attr('src') || '').trim(); if (!src) return;
    try {
      const abs = new URL(src, baseUrl).toString();
      const inHead = headScriptSet.has(el);
      const attrs = $(el).attr() || {};
      const blocking = inHead && !('async' in attrs) && !('defer' in attrs);
      push(abs, 'script', new URL(abs).origin !== base.origin, blocking);
    } catch {}
  });

  // Images
  $('img[src]').each((_, el) => {
    const src = String($(el).attr('src') || '').trim(); if (!src) return;
    try {
      const abs = new URL(src, baseUrl).toString();
      push(abs, 'image', new URL(abs).origin !== base.origin, false);
    } catch {}
  });

  // Media
  $('video[src], audio[src], source[src], iframe[src]').each((_, el) => {
    const src = String($(el).attr('src') || '').trim(); if (!src) return;
    try {
      const abs = new URL(src, baseUrl).toString();
      push(abs, 'media', new URL(abs).origin !== base.origin, false);
    } catch {}
  });

  // Fonts (best-effort via rel=preload as=font)
  $('link[rel="preload"][as="font"][href]').each((_, el) => {
    const href = String($(el).attr('href') || '').trim(); if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      push(abs, 'font', new URL(abs).origin !== base.origin, false);
    } catch {}
  });

  return assets;
}

/** NEW: probe asset HEAD (fallback to range GET) */
async function probeAsset(url: string): Promise<Pick<AssetInfo,'status'|'contentType'|'bytes'>> {
  try {
    const h = await got.head(url, { followRedirect: true, throwHttpErrors: false, timeout: { request: 12000 }, headers: { 'user-agent': UA } });
    const ct = (h.headers['content-type'] as string) || null;
    const len = h.headers['content-length'] != null ? Number(h.headers['content-length']) : null;
    return { status: h.statusCode, contentType: ct, bytes: Number.isFinite(len||NaN) ? len : null };
  } catch {
    try {
      const g = await got(url, { method: 'GET', followRedirect: true, throwHttpErrors: false, timeout: { request: 12000 }, headers: { 'user-agent': UA, Range: 'bytes=0-0' } });
      const ct = (g.headers['content-type'] as string) || null;
      const len = g.headers['content-range']
        ? Number(String(g.headers['content-range']).split('/').pop())
        : (g.headers['content-length'] != null ? Number(g.headers['content-length']) : null);
      return { status: g.statusCode, contentType: ct, bytes: Number.isFinite(len||NaN) ? len : null };
    } catch {
      return { status: undefined, contentType: null, bytes: null };
    }
  }
}

/** NEW: fetch sizes for a limited set of assets with concurrency */
async function auditAssets(assets: AssetInfo[], maxAssets = 80, concurrency = 6) {
  const slice = assets.slice(0, maxAssets);
  const out: AssetInfo[] = Array.from(slice);
  let i = 0;
  async function worker() {
    while (i < slice.length) {
      const idx = i++;
      const a = slice[idx];
      const meta = await probeAsset(a.url);
      out[idx] = { ...a, ...meta };
    }
  }
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  const sorted = out
    .filter(a => a.bytes != null)
    .sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
  return { scanned: slice.length, assets: out, top10: sorted.slice(0, 10) };
}

async function hreflangBackrefs(samples: Array<{ lang: string; href: string }>, selfUrl: string, max = 5): Promise<HreflangBackref[]> {
  const picks = samples.slice(0, max);
  const res: HreflangBackref[] = [];
  for (const { lang, href } of picks) {
    try {
      const r = await fetchHtml(href);
      const $ = cheerio.load(r.body);
      let ok = false;
      $('link[rel="alternate"][hreflang]').each((_, el) => {
        const h = String($(el).attr('href') || '').trim();
        if (h && norm(h) === norm(selfUrl)) ok = true;
      });
      res.push({ lang, href: r.finalUrl, ok });
    } catch {
      res.push({ lang, href, ok: false });
    }
  }
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url: string };
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });

    // 1) Fetch source page
    const page = await fetchHtml(url);
    const finalUrl = page.finalUrl;
    const origin = new URL(finalUrl).origin;

    // Parse page SEO
    const seo = parseSEO(page.body, finalUrl, page.headers, page.status);

    // 2) Robots.txt & sitemaps
    let robotsTxt = '';
    let robotsInfo: any = { blocked: false, matched: null, sitemaps: [] as string[] };
    try {
      const rob = await got(`${origin}/robots.txt`, { timeout: { request: 15000 }, throwHttpErrors: false, headers: { 'user-agent': UA } });
      robotsTxt = rob.body || '';
      const { sitemaps, rules } = parseRobotsForStarAgent(robotsTxt);
      const match = robotsMatch(new URL(finalUrl).pathname, rules);
      robotsInfo = {
        blocked: !!(match && match.type === 'disallow' && match.path !== ''),
        matched: match,
        sitemaps,
      };
    } catch {}

    // 3) Sitemap inclusion
    const sitemapCandidates = [...new Set([
      ...robotsInfo.sitemaps,
      ...discoverLikelySitemaps(origin),
    ])];
    const sitemapCheck = await checkSitemapsForUrl(sitemapCandidates, finalUrl);

    // 4) Canonical reciprocity & conflicts
    const conflicts: Conflict[] = [];
    let canonicalTarget: { url?: string; status?: number; selfCanonical?: boolean; loopBack?: boolean } = {};
    if (seo.canonical && norm(seo.canonical) !== norm(finalUrl)) {
      try {
        const can = await fetchHtml(seo.canonical);
        const canSeo = parseSEO(can.body, can.finalUrl, can.headers, can.status);
        canonicalTarget = {
          url: can.finalUrl,
          status: can.status,
          selfCanonical: !!(canSeo.canonical && norm(canSeo.canonical) === norm(can.finalUrl)),
          loopBack: !!(canSeo.canonical && norm(canSeo.canonical) === norm(finalUrl)),
        };
        if (canonicalTarget.loopBack) conflicts.push('Canonical loop: page canonicalizes to a URL that canonicalizes back here.');
        if (can.status && can.status >= 400) conflicts.push(`Canonical target returns ${can.status}.`);
      } catch {
        conflicts.push('Canonical target fetch failed.');
      }
    }

    // 5) AMP reciprocity
    let amp: { ampUrl?: string; backCanonicalOk?: boolean; status?: number } = {};
    let ampLinks: string[] = [];
    let ampAssetsTop: { scanned:number; assets: AssetInfo[]; top10: AssetInfo[] } | null = null;

    if (seo.ampHtml) {
      try {
        const ampR = await fetchHtml(seo.ampHtml);
        const ampSeo = parseSEO(ampR.body, ampR.finalUrl, ampR.headers, ampR.status);
        const $amp = cheerio.load(ampR.body);
        ampLinks = extractAllLinks($amp, ampR.finalUrl, 1000);
        const ampAssets = gatherAssets($amp, ampR.finalUrl);
        ampAssetsTop = await auditAssets(ampAssets, 60, 6);

        amp = {
          ampUrl: ampR.finalUrl,
          status: ampR.status,
          backCanonicalOk: !!(ampSeo.canonical && norm(ampSeo.canonical) === norm(finalUrl)),
        };
        if (amp.status && amp.status >= 400) conflicts.push(`AMP page returns ${amp.status}.`);
        if (amp.backCanonicalOk === false) conflicts.push('AMP page missing canonical back-link to this URL.');
      } catch {
        conflicts.push('AMP page fetch failed.');
      }
    }

    // 6) Hreflang reciprocity (sample up to 5)
    let hreflangBack: HreflangBackref[] = [];
    if (seo.hreflangMap?.length) {
      hreflangBack = await hreflangBackrefs(seo.hreflangMap, finalUrl, 5);
      const missing = hreflangBack.filter(h => !h.ok);
      if (missing.length) conflicts.push(`Hreflang reciprocity missing for: ${missing.map(m=>m.lang).join(', ')}.`);
    }

    // 7) Meta/X-Robots conflicts & “trap” links
    if (seo.robotsMeta?.noindex && sitemapCheck.found) conflicts.push('URL is NOINDEX but included in sitemap.');
    if (seo.http?.xRobotsTag && /noindex/i.test(seo.http.xRobotsTag) && sitemapCheck.found) conflicts.push('X-Robots-Tag: noindex while URL is in sitemap.');
    if (robotsInfo.blocked && sitemapCheck.found) conflicts.push('URL is disallowed in robots.txt but present in sitemap.');

    const $ = cheerio.load(page.body);

    // 8) Internal referrers via sitemap sampling
    const collectionList = sitemapCandidates.length ? sitemapCandidates : discoverLikelySitemaps(origin);
    const internalUrls = await collectSitemapUrls(collectionList, origin, 5, 150);
    const pathRoot = '/' + (new URL(finalUrl).pathname.split('/').filter(Boolean)[0] || '');
    const prioritized = [
      ...internalUrls.filter(u => new URL(u).pathname.startsWith(pathRoot) && norm(u) !== norm(finalUrl)),
      ...internalUrls.filter(u => !new URL(u).pathname.startsWith(pathRoot) && norm(u) !== norm(finalUrl)),
    ];
    const inlinkScan = await findInternalReferrers(prioritized, finalUrl, 40);

    // 9) NEW: All links on NON-AMP page + asset audit
    const pageLinks = extractAllLinks($, finalUrl, 2000);
    const pageAssets = gatherAssets($, finalUrl);
    const pageAssetsTop = await auditAssets(pageAssets, 80, 6);

    // 10) Outbound pointers snapshot
    const paramLinks = new Set<string>();
    $('a[href]').each((_, el) => {
      const href = String($(el).attr('href') || '').trim();
      if (!href) return;
      try {
        const u = new URL(href, origin);
        const hasTrap = Array.from(u.searchParams.keys()).some(k =>
          /^(utm_|ref|session|phpsessid|sid|sort|order|view|filter|color|size|per_page|page|start|offset|cursor)$/i.test(k)
        );
        if (hasTrap) paramLinks.add(u.toString());
      } catch {}
    });

    const pointers = {
      canonical: seo.canonical || null,
      amphtml: seo.ampHtml || null,
      ogUrl: seo.og?.['og:url'] || null,
      twitterUrl: seo.twitter?.['twitter:url'] || null,
      prev: $('link[rel="prev"]').attr('href') || null,
      next: $('link[rel="next"]').attr('href') || null,
      manifest: seo.manifest || null,
      hreflang: (seo.hreflangMap || []).map(h => ({ lang: h.lang, href: h.href })),
      parameterizedLinksSample: Array.from(paramLinks).slice(0, 15),
    };

    return new Response(JSON.stringify({
      ok: true,
      data: {
        source: { url: url, finalUrl, status: page.status },
        robots: {
          blocked: robotsInfo.blocked,
          matchedRule: robotsInfo.matched,
          sitemaps: collectionList.slice(0, 10),
        },
        sitemap: {
          tested: sitemapCheck.tested,
          found: sitemapCheck.found,
          sample: sitemapCheck.sample || null,
        },
        canonical: {
          pageCanonical: seo.canonical || null,
          target: canonicalTarget,
        },
        amp,
        hreflang: {
          total: seo.hreflangMap?.length || 0,
          checked: hreflangBack.length,
          reciprocity: hreflangBack,
        },
        headers: {
          xRobotsTag: seo.http?.xRobotsTag || null,
        },
        conflicts,
        pointers,
        inlinks: {
          searched: inlinkScan.searched,
          found: inlinkScan.found.length,
          referrers: inlinkScan.found.slice(0, 20),
        },

        // NEW: Links (non-AMP & AMP)
        links: {
          nonAmp: { total: pageLinks.length, list: pageLinks.slice(0, 1000) },
          amp: seo.ampHtml ? { total: ampLinks.length, list: ampLinks.slice(0, 1000) } : null
        },

        // NEW: Heavy assets (sizes/status/content-type, with top 10)
        heavy: {
          page: { scanned: pageAssetsTop.scanned, top10: pageAssetsTop.top10, total: pageAssetsTop.assets.length, assets: pageAssetsTop.assets },
          amp: ampAssetsTop ? { scanned: ampAssetsTop.scanned, top10: ampAssetsTop.top10, total: ampAssetsTop.assets.length, assets: ampAssetsTop.assets } : null
        }
      }
    }), { status: 200, headers: { 'content-type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
