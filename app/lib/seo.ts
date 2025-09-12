import * as cheerio from 'cheerio';

/* ------------ types ------------ */
export type RobotsFlags = {
  raw?: string;
  index: boolean;
  follow: boolean;
  noindex?: boolean;
  nofollow?: boolean;
  noarchive?: boolean;
  nosnippet?: boolean;
  maxSnippet?: number | null;
  maxImagePreview?: string | null;
  maxVideoPreview?: number | null;
};

export type DupReport = {
  comparedUrl?: string;
  similarity?: number;   // 0..1
  pageWords?: number;
  comparedWords?: number;
  risk?: 'low'|'medium'|'high';
};

export type ScoreBreakdown = {
  overall: number;
  content: number;
  technical: number;
  indexing: number;
  links: number;
  structured: number;
  notes: string[];
};

export type ContentStats = {
  words: number;
  sentences: number;
  readMinutes: number;   // rounded up
  flesch: number;        // Flesch Reading Ease
};

export type SecurityHeaders = {
  hsts: string | null;
  csp: string | null;
  xFrameOptions: string | null;
  xContentTypeOptions: string | null;
  referrerPolicy: string | null;
  permissionsPolicy: string | null;
};

export type SEOResult = {
  url: string;
  finalUrl?: string;
  redirected?: boolean;

  http: {
    status?: number;
    contentType?: string;
    contentLength?: number | null;
    cacheControl?: string;
    xRobotsTag?: string;
    xPoweredBy?: string;
    server?: string;
    security?: SecurityHeaders;        // NEW
    scheme?: 'http'|'https';
  };

  title?: string;
  titleLength: number;
  metaDescription?: string;
  descriptionLength: number;

  canonical?: string;
  canonicalStatus: 'self'|'other-domain'|'other-path'|'relative'|'multiple'|'missing';

  robotsMeta: RobotsFlags;

  viewport?: string;
  viewportFlags: { hasWidthDevice: boolean; hasInitialScale: boolean; blocksZoom: boolean };
  lang?: string;
  charset?: string;

  h1Count: number;
  headings: { h2: number; h3: number };
  headingsList?: Array<{ level: 'h1'|'h2'|'h3'; text: string }>;  // NEW (optional)

  hreflang: string[];
  hreflangMap: { lang: string; href: string }[];
  hreflangValidation: { duplicates: string[]; invalid: string[]; hasXDefault: boolean };

  images: { total:number; missingAlt:number; missingDimensions:number; missingLoading:number };

  links: { total: number; internal: number; external: number; nofollow: number };

  resourceHints: { dnsPrefetch: number; preconnect: number; preload: number };
  renderBlocking: { stylesheets: number; scriptsHeadBlocking: number; scriptsTotal: number };

  favicon?: string;
  appleTouchIcon?: string;
  manifest?: string | undefined;
  ampHtml?: string | undefined;

  og: Record<string,string>;
  twitter: Record<string,string>;

  schemaTypes: string[];
  schemaAudit: {
    Article?: { hasHeadline: boolean; hasDatePublished: boolean; hasAuthor: boolean };
    Organization?: { hasName: boolean; hasLogo: boolean };
    BreadcrumbList?: { present: boolean };
  };

  duplication?: DupReport;
  score?: ScoreBreakdown;

  contentStats?: ContentStats;         // NEW

  _warnings: string[];
  _issues: string[];
};

/* ------------ helpers ------------ */
function parseRobotsMeta(raw?: string): RobotsFlags {
  const flags: RobotsFlags = {
    raw, index: true, follow: true,
    maxSnippet: null, maxImagePreview: null, maxVideoPreview: null
  };
  if (!raw) return flags;
  const parts = raw.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  for (const p of parts) {
    if (p === 'noindex') { flags.noindex = true; flags.index = false; }
    if (p === 'nofollow') { flags.nofollow = true; flags.follow = false; }
    if (p === 'none') { flags.noindex = true; flags.nofollow = true; flags.index = false; flags.follow = false; }
    if (p === 'noarchive') flags.noarchive = true;
    if (p === 'nosnippet') flags.nosnippet = true;
    const [k,v] = p.split(':').map(x=>x.trim());
    if (k === 'max-snippet') flags.maxSnippet = v ? Number(v) : null;
    if (k === 'max-image-preview') flags.maxImagePreview = v || null;
    if (k === 'max-video-preview') flags.maxVideoPreview = v ? Number(v) : null;
  }
  return flags;
}
function isValidHreflang(v: string) {
  const lower = v.toLowerCase();
  if (lower === 'x-default') return true;
  return /^[a-z]{2,3}(-[a-z]{2})?$/.test(lower);
}
function abs(base: URL, href?: string) {
  if (!href) return undefined;
  try { return new URL(href, base).toString(); } catch { return href; }
}

/* --- content extraction + readability --- */
export function extractMainText(html: string) {
  const $ = cheerio.load(html);
  $('script,style,template,noscript,svg,nav,header,footer,form,aside,iframe').remove();
  const root = $('main').length ? $('main') : ($('article').length ? $('article') : $('body'));
  const text = root.text().replace(/\s+/g, ' ').trim();
  const words = text ? text.split(/\s+/).length : 0;
  return { text, words };
}

function countSyllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  // naive heuristic
  const m = w.replace(/e\b/g,'').match(/[aeiouy]{1,2}/g);
  return Math.max(1, (m?.length || 0));
}
export function readabilityStats(text: string): ContentStats {
  const wordsArr = text.split(/\s+/).filter(Boolean);
  const words = wordsArr.length;
  const sentences = Math.max(1, (text.match(/[.!?]+/g) || []).length);
  const syllables = wordsArr.reduce((sum,w)=> sum + countSyllables(w), 0);
  // Flesch Reading Ease
  const flesch = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words || 0);
  const readMinutes = Math.max(1, Math.ceil(words / 225)); // ~225 wpm
  return { words, sentences, readMinutes, flesch: Number((flesch||0).toFixed(1)) };
}

/* --- scoring --- */
export function scoreFrom(result: SEOResult): ScoreBreakdown {
  let notes: string[] = [];
  const cap = (v: number, min=0, max=100) => Math.max(min, Math.min(max, v));
  const start = () => 100;

  // Content
  let content = start();
  if (!result.title) { content -= 40; notes.push('content:title:missing'); }
  else if (result.titleLength < 30 || result.titleLength > 65) { content -= 8; notes.push('content:title:length'); }
  if (!result.metaDescription) { content -= 15; notes.push('content:description:missing'); }
  else if (result.descriptionLength < 70 || result.descriptionLength > 160) { content -= 6; notes.push('content:description:length'); }
  if (result.h1Count === 0) { content -= 12; notes.push('content:h1:none'); }
  if (result.h1Count > 1) { content -= 8; notes.push('content:h1:multiple'); }
  if ((result.images?.missingAlt || 0) > 0) { content -= Math.min(10, result.images!.missingAlt); notes.push('content:images:alt'); }
  if (!result.og['og:title'] || !result.og['og:description']) { content -= 6; notes.push('content:og:incomplete'); }
  if (!result.twitter['twitter:card']) { content -= 3; notes.push('content:twitter:missing'); }
  if (result.contentStats && result.contentStats.words < 300) { content -= 12; notes.push('content:thin'); }
  if (result.duplication?.risk === 'high') { content -= 25; notes.push('content:duplicate:high'); }
  if (result.duplication?.risk === 'medium') { content -= 10; notes.push('content:duplicate:medium'); }
  content = cap(content);

  // Technical
  let technical = start();
  if (!result.viewport) { technical -= 10; notes.push('tech:viewport:missing'); }
  if (result.viewportFlags.blocksZoom) { technical -= 5; notes.push('tech:viewport:zoom'); }
  if (!result.lang) { technical -= 5; notes.push('tech:lang:missing'); }
  if (!result.charset) { technical -= 4; notes.push('tech:charset:missing'); }
  if (result.renderBlocking.stylesheets > 3) { technical -= Math.min(12, result.renderBlocking.stylesheets * 2); notes.push('tech:css:blocking'); }
  if (result.renderBlocking.scriptsHeadBlocking > 0) { technical -= Math.min(12, result.renderBlocking.scriptsHeadBlocking * 3); notes.push('tech:head-scripts:blocking'); }
  if (result.links.total > 300) { technical -= 6; notes.push('tech:links:too-many'); }
  if (result.canonicalStatus === 'multiple') { technical -= 20; notes.push('tech:canonical:multiple'); }
  if (result.canonicalStatus === 'missing') { technical -= 6; notes.push('tech:canonical:missing'); }
  if (result.http.scheme === 'http') { technical -= 10; notes.push('tech:http:not-secure'); }
  // security headers (light deduction)
  const sec = result.http.security;
  if (sec) {
    if (!sec.hsts) { technical -= 3; notes.push('tech:security:hsts'); }
    if (!sec.csp) { technical -= 3; notes.push('tech:security:csp'); }
    if (!sec.xContentTypeOptions) { technical -= 1; notes.push('tech:security:xcto'); }
    if (!sec.xFrameOptions) { technical -= 1; notes.push('tech:security:xfo'); }
    if (!sec.referrerPolicy) { technical -= 1; notes.push('tech:security:referrer'); }
  }
  technical = cap(technical);

  // Indexing
  let indexing = start();
  if (result.robotsMeta.noindex) { indexing -= 100; notes.push('index:noindex'); }
  if (result.robotsMeta.nofollow) { indexing -= 8; notes.push('index:nofollow'); }
  indexing = cap(indexing);

  // Links
  let links = start();
  if (result.links.nofollow > result.links.total * 0.5) { links -= 10; notes.push('links:nofollow:many'); }
  links = cap(links);

  // Structured
  let structured = start();
  if (!result.schemaTypes.length) { structured -= 10; notes.push('schema:none'); }
  if (result.schemaAudit.Article && (!result.schemaAudit.Article.hasHeadline || !result.schemaAudit.Article.hasAuthor || !result.schemaAudit.Article.hasDatePublished)) {
    structured -= 8; notes.push('schema:article:incomplete');
  }
  if (result.schemaAudit.Organization && (!result.schemaAudit.Organization.hasName || !result.schemaAudit.Organization.hasLogo)) {
    structured -= 6; notes.push('schema:org:incomplete');
  }
  structured = cap(structured);

  const weights = { content: 0.30, technical: 0.25, indexing: 0.25, links: 0.10, structured: 0.10 };
  const overall = Math.round(
    content * weights.content +
    technical * weights.technical +
    indexing * weights.indexing +
    links * weights.links +
    structured * weights.structured
  );

  return { overall, content: Math.round(content), technical: Math.round(technical), indexing: Math.round(indexing), links: Math.round(links), structured: Math.round(structured), notes };
}

/* --- main parser (unchanged logic + small extras) --- */
export function parseSEO(html: string, baseUrl: string, respHeaders?: Record<string, any>, respStatus?: number): SEOResult {
  const $ = cheerio.load(html);
  const urlObj = new URL(baseUrl);
  const warnings: string[] = [];
  const issues: string[] = [];

  const http: SEOResult['http'] = {
    status: respStatus,
    contentType: String(respHeaders?.['content-type'] || ''),
    contentLength: Number(respHeaders?.['content-length'] || NaN),
    cacheControl: String(respHeaders?.['cache-control'] || ''),
    xRobotsTag: String(respHeaders?.['x-robots-tag'] || respHeaders?.['X-Robots-Tag'] || ''),
    xPoweredBy: String(respHeaders?.['x-powered-by'] || ''),
    server: String(respHeaders?.['server'] || ''),
    scheme: urlObj.protocol === 'https:' ? 'https' : 'http',
    security: {
      hsts: respHeaders?.['strict-transport-security'] ? String(respHeaders['strict-transport-security']) : null,
      csp: respHeaders?.['content-security-policy'] ? String(respHeaders['content-security-policy']) : null,
      xFrameOptions: respHeaders?.['x-frame-options'] ? String(respHeaders['x-frame-options']) : null,
      xContentTypeOptions: respHeaders?.['x-content-type-options'] ? String(respHeaders['x-content-type-options']) : null,
      referrerPolicy: respHeaders?.['referrer-policy'] ? String(respHeaders['referrer-policy']) : null,
      permissionsPolicy: respHeaders?.['permissions-policy'] ? String(respHeaders['permissions-policy']) : null
    }
  };

  if (http.scheme === 'http') warnings.push('Page served over HTTP; use HTTPS.');
  if (!http.security?.hsts && http.scheme === 'https') warnings.push('HSTS header missing.');
  if (!http.security?.csp) warnings.push('Content-Security-Policy not present.');
  if (!http.security?.xContentTypeOptions) warnings.push('X-Content-Type-Options missing.');
  if (!http.security?.xFrameOptions) warnings.push('X-Frame-Options missing.');
  if (!http.security?.referrerPolicy) warnings.push('Referrer-Policy missing.');

  // Title / description
  const title = ($('title').first().text() || '').trim();
  const metaDescription = ($('meta[name="description"]').attr('content') || '').trim() || undefined;
  const titleLength = title.length;
  const descriptionLength = (metaDescription || '').length;
  if (!title) issues.push('Missing <title>.'); else if (titleLength < 30 || titleLength > 65) warnings.push(`Title length suboptimal (${titleLength}).`);
  if (!metaDescription) warnings.push('Missing meta description.'); else if (descriptionLength < 70 || descriptionLength > 160) warnings.push(`Description length suboptimal (${descriptionLength}).`);

  // Canonical
  const canonEls = $('link[rel="canonical"]');
  let canonical: string | undefined;
  let canonicalStatus: SEOResult['canonicalStatus'] = 'missing';
  if (canonEls.length > 1) { canonicalStatus = 'multiple'; issues.push('Multiple canonical tags found.'); canonical = (canonEls.first().attr('href') || '').trim() || undefined; }
  else if (canonEls.length === 1) {
    const raw = (canonEls.attr('href') || '').trim();
    canonical = raw ? abs(urlObj, raw) : undefined;
    if (!canonical) canonicalStatus = 'missing';
    else {
      try {
        const cu = new URL(canonical);
        if (cu.origin !== urlObj.origin) canonicalStatus = 'other-domain';
        else if (cu.pathname !== urlObj.pathname || cu.search !== urlObj.search) canonicalStatus = 'other-path';
        else canonicalStatus = 'self';
      } catch {}
      if (raw?.startsWith('/')) warnings.push('Canonical is relative; consider absolute URL.');
    }
  } else { canonicalStatus = 'missing'; warnings.push('Missing canonical URL.'); }

  // Robots (meta + header)
  const robotsMeta = parseRobotsMeta(($('meta[name="robots"]').attr('content') || '').trim() || undefined);
  const robotsHeader = parseRobotsMeta(http.xRobotsTag || undefined);
  if (robotsHeader.noindex) { robotsMeta.noindex = true; robotsMeta.index = false; }
  if (robotsHeader.nofollow) { robotsMeta.nofollow = true; robotsMeta.follow = false; }
  if (robotsMeta.noindex) issues.push('Page is set to NOINDEX.');
  if (robotsMeta.nofollow) warnings.push('Page is set to NOFOLLOW.');

  // Basics
  const viewport = ($('meta[name="viewport"]').attr('content') || '').trim() || undefined;
  const viewportFlags = {
    hasWidthDevice: /width\s*=\s*device-width/i.test(viewport || ''),
    hasInitialScale: /initial-scale\s*=/i.test(viewport || ''),
    blocksZoom: /\buser-scalable\s*=\s*no\b/i.test(viewport || '') || /\bmaximum-scale\s*=\s*0?\.*9\b/i.test(viewport || '')
  };
  const lang = ($('html').attr('lang') || $('html').attr('xml:lang') || '').trim() || undefined;
  const charset = ($('meta[charset]').attr('charset') || '').trim() || undefined;
  if (!viewport) warnings.push('Missing responsive <meta name="viewport">.');
  if (!lang) warnings.push('<html lang> is missing.');
  if (!charset) warnings.push('Missing <meta charset>.');
  if (viewportFlags.blocksZoom) warnings.push('Viewport blocks zoom (accessibility).');

  // Headings
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  const headingsList: Array<{level:'h1'|'h2'|'h3'; text:string}> = [];
  $('h1,h2,h3').each((_, el)=>{
    const tag = (el.tagName as 'h1'|'h2'|'h3');
    headingsList.push({ level: tag, text: cheerio.load(el).text().trim().slice(0,200) });
  });
  if (h1Count === 0) warnings.push('No <h1> found.');
  if (h1Count > 1) warnings.push('Multiple <h1> elements found.');
  if (h2Count === 0) warnings.push('No <h2> headings found (thin outline).');

  // Hreflang
  const hreflang: string[] = [];
  const hreflangMap: { lang:string; href:string }[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  let hasXDefault = false;
  const seen = new Set<string>();
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const v = String(cheerio.load(el)(el).attr('hreflang') || '').trim();
    const href = String(cheerio.load(el)(el).attr('href') || '').trim();
    if (!v) return;
    hreflang.push(v);
    const lower = v.toLowerCase();
    if (!isValidHreflang(v)) invalid.push(v);
    if (seen.has(lower)) duplicates.push(v); else seen.add(lower);
    if (lower === 'x-default') hasXDefault = true;
    if (href) hreflangMap.push({ lang: v, href: abs(urlObj, href)! });
  });
  if (invalid.length) warnings.push(`Invalid hreflang values: ${invalid.join(', ')}`);

  // Images
  const imgs = $('img'); let missingAlt = 0, missingDim = 0, missingLoading = 0;
  imgs.each((_, el) => {
    const $el = cheerio.load(el)(el) as any;
    const alt = ($el.attribs?.alt||'').trim();
    const width = ($el.attribs?.width||'').trim();
    const height = ($el.attribs?.height||'').trim();
    const loading = ($el.attribs?.loading||'').trim().toLowerCase();
    if (!alt) missingAlt++; if (!width || !height) missingDim++; if (loading && loading !== 'lazy') missingLoading++;
  });
  if (missingAlt > 0) warnings.push(`${missingAlt} images missing alt.`);
  if (missingDim > 0) warnings.push(`${missingDim} images missing explicit width/height.`);

  // Links
  const anchors = $('a[href]'); let internal = 0, external = 0, nofollow = 0;
  anchors.each((_, el) => {
    const $a = cheerio.load(el)(el) as any;
    const href = String($a.attribs?.href || '').trim(); if (!href) return;
    const rel = String($a.attribs?.rel || '').toLowerCase(); if (rel.includes('nofollow')) nofollow++;
    try { const u = new URL(href, urlObj.origin);
      if (/^https?:/.test(u.protocol)) { if (u.origin === urlObj.origin) internal++; else external++; }
    } catch {}
  });
  if ((anchors.length || 0) > 300) warnings.push('Large number of links on page (>300).');

  // Resource hints / render blocking
  const resourceHints = {
    dnsPrefetch: $('link[rel="dns-prefetch"]').length,
    preconnect: $('link[rel="preconnect"]').length,
    preload: $('link[rel="preload"]').length
  };
  let blockingCSS = 0, blockingHeadScripts = 0, totalScripts = $('script').length;
  $('link[rel="stylesheet"]').each((_, el)=>{
    const rel = String(cheerio.load(el)(el).attribs?.rel||'').toLowerCase();
    const media = String(cheerio.load(el)(el).attribs?.media||'').trim();
    const disabled = (cheerio.load(el)(el).attribs?.disabled) !== undefined;
    if (rel === 'stylesheet' && !media && !disabled) blockingCSS++;
  });
  $('head script[src]').each((_, el)=>{
    const a = cheerio.load(el)(el).attribs;
    if (!('async' in a) && !('defer' in a)) blockingHeadScripts++;
  });
  if (blockingCSS > 3) warnings.push(`Many render-blocking stylesheets (${blockingCSS}).`);
  if (blockingHeadScripts > 0) warnings.push(`Render-blocking scripts in <head> (${blockingHeadScripts}).`);

  // Icons / PWA / AMP
  const favicon = abs(urlObj, $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href'));
  const appleTouchIcon = abs(urlObj, $('link[rel="apple-touch-icon"]').attr('href'));
  const manifest = abs(urlObj, $('link[rel="manifest"]').attr('href'));
  const ampHtml = abs(urlObj, $('link[rel="amphtml"]').attr('href'));

  // Social
  const og: Record<string,string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const key = String(cheerio.load(el)(el).attribs?.property||'').toLowerCase();
    const val = String(cheerio.load(el)(el).attribs?.content||'').trim();
    if (key) og[key] = val;
  });
  const twitter: Record<string,string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const key = String(cheerio.load(el)(el).attribs?.name||'').toLowerCase();
    const val = String(cheerio.load(el)(el).attribs?.content||'').trim();
    if (key) twitter[key] = val;
  });
  if (!og['og:title'] || !og['og:description']) warnings.push('Open Graph title/description incomplete.');
  if (!twitter['twitter:card']) warnings.push('Missing twitter:card.');

  // Structured data
  const schemaTypes: string[] = [];
  let articleAudit: { hasHeadline:boolean; hasDatePublished:boolean; hasAuthor:boolean } | undefined;
  let orgAudit: { hasName:boolean; hasLogo:boolean } | undefined;
  let breadcrumbAudit: { present:boolean } | undefined;
  const dig = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(dig); return; }
    if (typeof node === 'object') {
      const t = node['@type'];
      if (t) {
        const arr = Array.isArray(t) ? t : [t];
        arr.forEach((x:any)=> schemaTypes.push(String(x)));
        if (arr.includes('Article') || arr.includes('NewsArticle') || arr.includes('BlogPosting')) {
          articleAudit = { hasHeadline: !!node.headline, hasDatePublished: !!node.datePublished, hasAuthor: !!(node.author || node.creator) };
        }
        if (arr.includes('Organization')) {
          orgAudit = { hasName: !!node.name, hasLogo: !!(node.logo) };
        }
        if (arr.includes('BreadcrumbList')) { breadcrumbAudit = { present: true }; }
      }
      Object.values(node).forEach(dig);
    }
  };
  $('script[type="application/ld+json"]').each((_, el) => { try {
    const txt = cheerio.load(el)(el).children().text();
    if (txt) dig(JSON.parse(txt));
  } catch {} });

  // Build result
  return {
    url: baseUrl,
    http,
    title, titleLength,
    metaDescription, descriptionLength,
    canonical, canonicalStatus,
    robotsMeta,
    viewport, viewportFlags,
    lang, charset,
    h1Count,
    headings: { h2: h2Count, h3: h3Count },
    headingsList,
    hreflang,
    hreflangMap,
    hreflangValidation: { duplicates, invalid, hasXDefault },
    images: { total: imgs.length, missingAlt, missingDimensions: missingDim, missingLoading },
    links: { total: anchors.length, internal, external, nofollow },
    resourceHints,
    renderBlocking: { stylesheets: blockingCSS, scriptsHeadBlocking: blockingHeadScripts, scriptsTotal: totalScripts },
    favicon, appleTouchIcon, manifest, ampHtml,
    og, twitter,
    schemaTypes,
    schemaAudit: {
      Article: articleAudit,
      Organization: orgAudit,
      BreadcrumbList: breadcrumbAudit || { present:false }
    },
    _warnings: warnings,
    _issues: issues
  };
}
