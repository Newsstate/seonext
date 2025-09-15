// app/api/amp-compare/route.ts
import { NextRequest } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';
import { parseSEO, extractMainText, jaccard } from '@/lib/seo';

export const runtime = 'nodejs';

type DiffRow = { key: string; a: any; b: any; same: boolean };

function asSet(arr?: string[]) {
  return new Set((arr || []).map(String));
}
function sameSet(a?: string[], b?: string[]) {
  const A = asSet(a), B = asSet(b);
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
}
function normalizeStr(v?: string | null) {
  return (v || '').toString().trim();
}

// pull amphtml from HTML
function findAmpHref(html: string, base: URL) {
  const $ = cheerio.load(html);
  const href = $('link[rel="amphtml"]').attr('href');
  if (!href) return null;
  try { return new URL(href, base).toString(); } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const { url, ampUrl: givenAmp } = await req.json() as { url: string; ampUrl?: string };
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });

    // Fetch Non-AMP
    const page = await got(url, { followRedirect: true, throwHttpErrors: false, timeout: { request: 20000 } });
    if (page.statusCode >= 400) {
      return new Response(JSON.stringify({ ok:false, error:`Source page returned ${page.statusCode}` }), { status:200 });
    }
    const base = new URL(page.url);
    const nonAmpHtml = page.body;
    const nonAmpSEO = parseSEO(nonAmpHtml, base.toString(), page.headers as any, page.statusCode);
    const nonAmpText = extractMainText(nonAmpHtml).text;

    // Resolve AMP URL: prefer provided, else link[rel=amphtml] we find in the page
    const ampUrl = givenAmp || nonAmpSEO.ampHtml || findAmpHref(nonAmpHtml, base);
    if (!ampUrl) {
      return new Response(JSON.stringify({ ok:true, data:{ hasAmp:false, reason:'No amphtml link found.' } }), { status:200 });
    }

    // Fetch AMP
    const ampResp = await got(ampUrl, { followRedirect: true, throwHttpErrors: false, timeout: { request: 20000 } });
    if (ampResp.statusCode >= 400) {
      return new Response(JSON.stringify({ ok:true, data:{ hasAmp:true, ampUrl, error:`AMP returned ${ampResp.statusCode}` } }), { status:200 });
    }
    const ampHtml = ampResp.body;
    const ampSEO = parseSEO(ampHtml, new URL(ampResp.url).toString(), ampResp.headers as any, ampResp.statusCode);
    const ampText = extractMainText(ampHtml).text;

    // Build diffs
    const diffs: DiffRow[] = [];

    const push = (key: string, a: any, b: any, compare?: (a:any,b:any)=>boolean) => {
      const same = compare ? compare(a,b) : (JSON.stringify(a) === JSON.stringify(b));
      diffs.push({ key, a, b, same });
    };

    // Basics
    push('title', nonAmpSEO.title, ampSEO.title);
    push('metaDescription', nonAmpSEO.metaDescription, ampSEO.metaDescription);
    push('canonical', nonAmpSEO.canonical, ampSEO.canonical);
    push('robotsMeta.raw', nonAmpSEO.robotsMeta?.raw || null, ampSEO.robotsMeta?.raw || null);
    push('robotsMeta.index', nonAmpSEO.robotsMeta?.index ?? null, ampSEO.robotsMeta?.index ?? null);
    push('robotsMeta.follow', nonAmpSEO.robotsMeta?.follow ?? null, ampSEO.robotsMeta?.follow ?? null);
    push('viewport', nonAmpSEO.viewport, ampSEO.viewport);
    push('lang', nonAmpSEO.lang, ampSEO.lang);

    // Headings
    push('h1Count', nonAmpSEO.h1Count, ampSEO.h1Count);
    push('headings.h2', nonAmpSEO.headings?.h2 ?? 0, ampSEO.headings?.h2 ?? 0);
    push('headings.h3', nonAmpSEO.headings?.h3 ?? 0, ampSEO.headings?.h3 ?? 0);

    // Links & images
    push('links.total', nonAmpSEO.links.total, ampSEO.links.total);
    push('links.internal', nonAmpSEO.links.internal, ampSEO.links.internal);
    push('links.external', nonAmpSEO.links.external, ampSEO.links.external);
    push('links.nofollow', nonAmpSEO.links.nofollow, ampSEO.links.nofollow);
    push('images.missingAlt', nonAmpSEO.images?.missingAlt ?? 0, ampSEO.images?.missingAlt ?? 0);

    // Social
    push('og:title', normalizeStr(nonAmpSEO.og['og:title']), normalizeStr(ampSEO.og['og:title']));
    push('og:description', normalizeStr(nonAmpSEO.og['og:description']), normalizeStr(ampSEO.og['og:description']));
    push('twitter:card', normalizeStr(nonAmpSEO.twitter['twitter:card']), normalizeStr(ampSEO.twitter['twitter:card']));

    // Structured data
    push('schemaTypes', nonAmpSEO.schemaTypes, ampSEO.schemaTypes, sameSet);

    // HTTP
    push('http.status', nonAmpSEO.http?.status ?? null, ampSEO.http?.status ?? null);
    push('http.contentType', nonAmpSEO.http?.contentType ?? null, ampSEO.http?.contentType ?? null);
    push('http.xRobotsTag', nonAmpSEO.http?.xRobotsTag ?? null, ampSEO.http?.xRobotsTag ?? null);

    // Content stats (words)
    push('content.words', nonAmpSEO.contentStats?.words ?? extractMainText(nonAmpHtml).words,
                            ampSEO.contentStats?.words ?? extractMainText(ampHtml).words);

    // Similarity
    const textSimilarity = Number(jaccard(nonAmpText, ampText).toFixed(3));

    const keyChanges = diffs.filter(d => !d.same);
    const summary = {
      similar: textSimilarity >= 0.8,
      textSimilarity,                // 0..1
      keyChangesCount: keyChanges.length
    };

    return new Response(JSON.stringify({
      ok: true,
      data: {
        hasAmp: true,
        sourceUrl: page.url,
        ampUrl: ampResp.url,
        summary,
        diffs
      }
    }), { status:200, headers:{ 'content-type':'application/json' }});
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
