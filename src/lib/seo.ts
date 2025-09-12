import * as cheerio from 'cheerio';

export type SEOResult = {
  url: string;
  finalUrl?: string;
  title?: string;
  metaDescription?: string;
  canonical?: string;
  robots?: string;
  h1Count: number;
  links: { total: number; internal: number; external: number; nofollow: number };
  og: Record<string,string>;
  twitter: Record<string,string>;
  schemaTypes: string[];
};

export function parseSEO(html: string, baseUrl: string): SEOResult {
  const $ = cheerio.load(html);
  const urlObj = new URL(baseUrl);

  const title = ($('title').first().text() || '').trim();
  const metaDescription = ($('meta[name="description"]').attr('content') || '').trim() || undefined;
  const canonical = ($('link[rel="canonical"]').attr('href') || '').trim() || undefined;
  const robots = ($('meta[name="robots"]').attr('content') || '').trim() || undefined;
  const h1Count = $('h1').length;

  // links
  const anchors = $('a[href]');
  let internal = 0, external = 0, nofollow = 0;
  anchors.each((_, el) => {
    const href = $(el).attr('href') || '';
    const rel = ($(el).attr('rel') || '').toLowerCase();
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
      const data = JSON.parse(txt);
      const collect = (node: any) => {
        if (!node) return;
        if (Array.isArray(node)) { node.forEach(collect); return; }
        if (typeof node === 'object') {
          if (node['@type']) {
            if (Array.isArray(node['@type'])) {
              node['@type'].forEach((t:any) => schemaTypes.push(String(t)));
            } else {
              schemaTypes.push(String(node['@type']));
            }
          }
          Object.values(node).forEach(collect);
        }
      };
      collect(data);
    } catch {}
  });

  return {
    url: baseUrl,
    title, metaDescription, canonical, robots,
    h1Count,
    links: { total: anchors.length, internal, external, nofollow },
    og, twitter, schemaTypes
  };
}
