import * as cheerio from 'cheerio';

export type SEOResult = {
  url: string;
  finalUrl?: string;
  title?: string;
  metaDescription?: string;
  canonical?: string;
  robots?: string;
  viewport?: string;
  lang?: string;
  h1Count: number;
  hreflang: string[];
  images: { total:number; missingAlt:number; };
  links: { total: number; internal: number; external: number; nofollow: number };
  og: Record<string,string>;
  twitter: Record<string,string>;
  schemaTypes: string[];
  _warnings?: string[];
  _issues?: string[];
};

export function parseSEO(html: string, baseUrl: string): SEOResult {
  const $ = cheerio.load(html);
  const urlObj = new URL(baseUrl);
  const warnings: string[] = [];
  const issues: string[] = [];

  const title = ($('title').first().text() || '').trim();
  const metaDescription = ($('meta[name="description"]').attr('content') || '').trim() || undefined;
  if (!title) warnings.push('Missing <title>.');
  if (!metaDescription) warnings.push('Missing meta description.');

  let canonical = ($('link[rel="canonical"]').attr('href') || '').trim() || undefined;
  if (canonical && canonical.startsWith('/')) {
    canonical = new URL(canonical, urlObj.origin).href;
  }

  const robots = ($('meta[name="robots"]').attr('content') || '').trim() || undefined;
  const viewport = ($('meta[name="viewport"]').attr('content') || '').trim() || undefined;
  const lang = ($('html').attr('lang') || $('html').attr('xml:lang') || '').trim() || undefined;
  if (!viewport) warnings.push('Missing responsive <meta name="viewport">.');
  if (!lang) warnings.push('<html lang> is missing.');

  const h1Count = $('h1').length;
  if (h1Count === 0) warnings.push('No <h1> found.');
  if (h1Count > 1) warnings.push('Multiple <h1> elements found.');

  // hreflang
  const hreflang: string[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const v = ($(el).attr('hreflang')||'').trim();
    if (v) hreflang.push(v);
  });

  // images
  const imgs = $('img');
  let missingAlt = 0;
  imgs.each((_, el) => {
    const alt = ($(el).attr('alt')||'').trim();
    if (!alt) missingAlt++;
  });

  // links
  const anchors = $('a[href]');
  let internal = 0, external = 0, nofollow = 0;
  anchors.each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href) return;
    const rel = (($(el).attr('rel') || '')).toLowerCase();
    if (rel.includes('nofollow')) nofollow++;
    try {
      const u = new URL(href, urlObj.origin);
      if (u.origin === urlObj.origin) internal++; else external++;
    } catch {}
  });

  // OG / Twitter
  const og: Record<string,string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const key = ($(el).attr('property')||'').toLowerCase();
    const val = ($(el).attr('content')||'').trim();
    if (key) og[key] = val;
  });
  const twitter: Record<string,string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const key = ($(el).attr('name')||'').toLowerCase();
    const val = ($(el).attr('content')||'').trim();
    if (key) twitter[key] = val;
  });

  // Schema types (JSON-LD)
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const txt = $(el).contents().text();
      if (!txt) return;
      const data = JSON.parse(txt);
      const collect = (node: any) => {
        if (!node) return;
        if (Array.isArray(node)) { node.forEach(collect); return; }
        if (typeof node === 'object') {
          if (node['@type']) {
            if (Array.isArray(node['@type'])) node['@type'].forEach((t:any)=> schemaTypes.push(String(t)));
            else schemaTypes.push(String(node['@type']));
          }
          Object.values(node).forEach(collect);
        }
      };
      collect(data);
    } catch {}
  });

  // Simple heuristics
  if (!canonical) warnings.push('Missing canonical URL.');
  if (!og['og:title'] || !og['og:description']) warnings.push('Open Graph title/description incomplete.');
  if (!twitter['twitter:card']) warnings.push('Missing twitter:card.');
  if ((anchors.length || 0) > 300) warnings.push('Large number of links on page (>300).');
  if (missingAlt > 0) warnings.push(`${missingAlt} images missing alt.`);

  return {
    url: baseUrl,
    title, metaDescription, canonical, robots,
    viewport, lang,
    h1Count,
    hreflang,
    images: { total: imgs.length, missingAlt },
    links: { total: anchors.length, internal, external, nofollow },
    og, twitter, schemaTypes,
    _warnings: warnings,
    _issues: issues
  };
}
