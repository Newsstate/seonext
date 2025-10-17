import { NextRequest } from 'next/server';
import * as cheerio from 'cheerio';

type DiscoverFinding = {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  detail: string;
  recommendation?: string;
  evidence?: any;
};

type DiscoverReport = {
  url: string;
  overallScore: number; // 0-100
  chance: 'Low' | 'Medium' | 'High';
  pillars: {
    contentQuality: number;
    freshness: number;
    imagery: number;
    metaPresentation: number;
    brandEEAT: number;
    experienceUX: number;
    technical: number;
  };
  findings: DiscoverFinding[];
  aiSuggestions?: {
    improvedTitle?: string[];
    improvedIntro?: string[];
    imageBriefs?: string[];
    schemaPatch?: Record<string, any>;
    checklist?: string[];
  };
  meta: Record<string, any>;
};

async function fetchHTML(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 SEOAuditBot' }});
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return await res.text();
}

function pxFromMetaContent(s?: string) {
  if (!s) return undefined;
  const m = s.match(/(\d{2,5})\s*[xX×]\s*(\d{2,5})/);
  if (!m) return undefined;
  return { w: Number(m[1]), h: Number(m[2]) };
}

function iso(s?: string) {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function daysAgo(isoStr?: string) {
  if (!isoStr) return undefined;
  const d = new Date(isoStr).getTime();
  const now = Date.now();
  return Math.round((now - d) / 86400000);
}

function clamp(n: number, lo=0, hi=100) { return Math.max(lo, Math.min(hi, n)); }

export async function POST(req: NextRequest) {
  try {
    const { url, pageHTML, useAI = true } = await req.json();
    if (!url && !pageHTML) {
      return new Response(JSON.stringify({ error: 'Provide url or pageHTML' }), { status: 400 });
    }

    const html = pageHTML ?? await fetchHTML(url);
    const $ = cheerio.load(html);

    // ---------- Extract essentials ----------
    const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    const desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
    const maxPreview = $('meta[name="robots"]').attr('content') || $('meta[name="googlebot"]').attr('content') || '';
    const canonical = $('link[rel="canonical"]').attr('href');
    const lang = $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content');
    const authorName = $('meta[name="author"]').attr('content') || $('[itemprop="author"], .author, .byline').first().text().trim();
    const datePublished = iso(
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      $('[itemprop="datePublished"]').attr('content') ||
      $('time[datetime]').attr('datetime')
    );
    const dateModified = iso(
      $('meta[property="article:modified_time"]').attr('content') ||
      $('[itemprop="dateModified"]').attr('content')
    );

    // Try extracting JSON-LD Article
    const ldJson: any[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).contents().text());
        if (Array.isArray(parsed)) parsed.forEach(p => ldJson.push(p));
        else ldJson.push(parsed);
      } catch {}
    });

    const articleNodes = ldJson.flatMap((n) => {
      if (!n) return [];
      if (n['@type'] === 'Article' || n['@type'] === 'NewsArticle' || (Array.isArray(n['@type']) && n['@type'].includes('Article'))) {
        return [n];
      }
      if (Array.isArray(n['@graph'])) {
        return n['@graph'].filter((g: any) => g['@type'] === 'Article' || g['@type'] === 'NewsArticle');
      }
      return [];
    });

    const articleNode = articleNodes[0];
    const ldImage = articleNode?.image?.url || (Array.isArray(articleNode?.image) ? articleNode?.image?.[0] : articleNode?.image);
    const ldAuthor = articleNode?.author?.name || (typeof articleNode?.author === 'string' ? articleNode.author : undefined);
    const ldDatePublished = iso(articleNode?.datePublished);
    const ldDateModified = iso(articleNode?.dateModified);

    // Lead image size hints
    const imgMeta = pxFromMetaContent($('meta[name="og:image:width"]').attr('content') && $('meta[name="og:image:height"]').attr('content')
      ? `${$('meta[name="og:image:width"]').attr('content')}x${$('meta[name="og:image:height"]').attr('content')}`
      : undefined);

    // Body text extraction (very light-weight)
    const articleSelectors = ['article', 'main', '.post-content', '.article-content', '.entry-content'];
    const bodyCandidates = articleSelectors.map(sel => $(sel).text().trim()).filter(Boolean);
    const bodyText = (bodyCandidates.sort((a,b)=>b.length-a.length)[0] || $('body').text()).replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    const h2Count = $('h2').length;
    const hasTOC = $('a[href^="#"]').length > 4;

    // Ads/UX heuristics
    const adLike = $('[class*="ads"], [id*="ads"], [class*="ad-"], [id*="ad-"]').length;
    const interstitialLike = $('[class*="subscribe"], [class*="overlay"], [class*="modal"]').length;

    // CWV hints (from meta if you store PSI elsewhere; here we just leave hooks)
    // You already have PSI hooks; wire LCP of lead image if available via your existing PSI card.
    const cwv = {
      lcpMs: undefined as number | undefined,
      cls: undefined as number | undefined,
      inpMs: undefined as number | undefined,
    };

    // ---------- Scoring ----------
    const findings: DiscoverFinding[] = [];

    // Imagery
    let imagery = 0;
    const hasLargePreview = /max-image-preview\s*:\s*large/i.test(maxPreview);
    const hasOgImage = Boolean(ogImage || ldImage);
    const largeEnough = imgMeta && (imgMeta.w >= 1200 || imgMeta.h >= 1200);
    imagery = (hasOgImage ? 40 : 0) + (hasLargePreview ? 40 : 0) + (largeEnough ? 20 : 0);

    if (!hasOgImage) findings.push({
      id: 'no_og_image',
      title: 'Missing Open Graph lead image',
      severity: 'high',
      detail: 'Discover prefers rich, compelling lead images.',
      recommendation: 'Add a primary image (ideally 1600×900 or larger) via og:image and twitter:image.',
    });
    if (!hasLargePreview) findings.push({
      id: 'no_max_preview',
      title: 'Missing `max-image-preview: large`',
      severity: 'medium',
      detail: 'Without this, Discover may show a small thumbnail.',
      recommendation: 'Add `<meta name="robots" content="max-image-preview:large">`.',
    });
    if (!largeEnough) findings.push({
      id: 'image_too_small',
      title: 'Lead image may be under 1200px',
      severity: 'medium',
      detail: 'Discover favors large, high-quality images.',
      recommendation: 'Use ≥1200px width (ideal: 1600+), good contrast, minimal text.',
      evidence: imgMeta || null
    });

    // Freshness
    const pub = datePublished || ldDatePublished;
    const mod = dateModified || ldDateModified || pub;
    const dPub = pub ? daysAgo(pub) : undefined;
    const dMod = mod ? daysAgo(mod) : undefined;
    let freshness = 50;
    if (dMod !== undefined) {
      if (dMod <= 7) freshness = 95;
      else if (dMod <= 30) freshness = 80;
      else if (dMod <= 90) freshness = 65;
      else freshness = 45;
    } else if (dPub !== undefined) {
      if (dPub <= 7) freshness = 90;
      else if (dPub <= 30) freshness = 75;
      else if (dPub <= 90) freshness = 60;
      else freshness = 40;
    }
    if (!pub && !mod) findings.push({
      id: 'no_dates',
      title: 'Publish/modified dates missing',
      severity: 'medium',
      detail: 'Dates help Discover understand recency.',
      recommendation: 'Expose ISO dates in HTML and JSON-LD Article.',
    });

    // Meta Presentation (title/description)
    const titleLen = title?.length || 0;
    let metaPresentation = 60;
    if (titleLen >= 35 && titleLen <= 68) metaPresentation += 20;
    if (desc && desc.length >= 60 && desc.length <= 160) metaPresentation += 10;
    if (/free|shocking|you won’t believe|click here/i.test(title || '')) {
      metaPresentation -= 20;
      findings.push({
        id: 'clickbait_title',
        title: 'Title risks clickbait signals',
        severity: 'low',
        detail: 'Over-sensational titles can underperform on Discover.',
        recommendation: 'Use clear benefit-driven titles without clickbait patterns.'
      });
    }

    // Brand / E-E-A-T
    let brandEEAT = 50;
    if (authorName || ldAuthor) brandEEAT += 10;
    if ($('a:contains("About")').length || $('a[href*="/about"]').length) brandEEAT += 5;
    if ($('a:contains("Contact")').length || $('a[href*="/contact"]').length) brandEEAT += 5;
    if ($('[rel="author"]').length) brandEEAT += 5;
    if ($('link[rel="publisher"]').length) brandEEAT += 5;
    if (brandEEAT <= 60) findings.push({
      id: 'weak_eeat',
      title: 'Weak visible E-E-A-T signals',
      severity: 'medium',
      detail: 'Clear author/brand identity improves trust.',
      recommendation: 'Add author bio page, About, Contact, editorial policy, and link them from the article.'
    });

    // Content quality heuristics
    let contentQuality = 50;
    if (wordCount >= 500) contentQuality += 10;
    if (wordCount >= 900) contentQuality += 10;
    if (h2Count >= 2) contentQuality += 10;
    if (hasTOC) contentQuality += 5;
    // Penalize boilerplate-only pages
    if (wordCount < 300) {
      contentQuality -= 20;
      findings.push({
        id: 'thin_content',
        title: 'Content may be thin',
        severity: 'high',
        detail: `Only ~${wordCount} words detected.`,
        recommendation: 'Add original insights, data points, quotes, and rich media to increase depth.'
      });
    }

    // Experience / UX
    let experienceUX = 60;
    if (adLike > 10 || interstitialLike > 3) {
      experienceUX -= 20;
      findings.push({
        id: 'intrusive_ui',
        title: 'Page may have intrusive overlays/ads',
        severity: 'medium',
        detail: 'Heavy interstitials degrade Discover experience.',
        recommendation: 'Reduce on-load overlays and ad density above the fold.'
      });
    }

    // Technical
    let technical = 60;
    if (!canonical) {
      technical -= 10;
      findings.push({
        id: 'no_canonical',
        title: 'Missing canonical tag',
        severity: 'low',
        detail: 'Canonical helps consolidation for Discover.',
        recommendation: 'Add a self-referencing canonical link.'
      });
    }
    if (!lang) {
      technical -= 5;
      findings.push({
        id: 'no_lang',
        title: 'Missing html[lang]',
        severity: 'low',
        detail: 'Language helps correct audience targeting.',
        recommendation: 'Set `<html lang="en-IN">` (or appropriate).'
      });
    }

    // Overall
    const weights = { contentQuality: 0.25, freshness: 0.15, imagery: 0.20, metaPresentation: 0.15, brandEEAT: 0.10, experienceUX: 0.10, technical: 0.05 };
    const overallScore = clamp(
      contentQuality * weights.contentQuality +
      freshness * weights.freshness +
      imagery * weights.imagery +
      metaPresentation * weights.metaPresentation +
      brandEEAT * weights.brandEEAT +
      experienceUX * weights.experienceUX +
      technical * weights.technical
    );

    const chance: DiscoverReport['chance'] =
      overallScore >= 80 ? 'High' : overallScore >= 60 ? 'Medium' : 'Low';

    const baseReport: DiscoverReport = {
      url: url ?? 'raw-html',
      overallScore: Math.round(overallScore),
      chance,
      pillars: {
        contentQuality: Math.round(contentQuality),
        freshness: Math.round(freshness),
        imagery: Math.round(imagery),
        metaPresentation: Math.round(metaPresentation),
        brandEEAT: Math.round(brandEEAT),
        experienceUX: Math.round(experienceUX),
        technical: Math.round(technical),
      },
      findings,
      meta: {
        title, desc, ogImage: ogImage || ldImage, canonical, lang,
        author: authorName || ldAuthor,
        datePublished: pub, dateModified: mod,
        maxImagePreviewTagPresent: hasLargePreview,
        imageSizeHint: imgMeta || null,
        wordCount, h2Count, hasTOC: !!hasTOC,
        adLike, interstitialLike,
        cwv,
      },
    };

    // ---------- Optional AI recommendations ----------
    if (!useAI) {
      return new Response(JSON.stringify(baseReport), { status: 200 });
    }

    // Build a compact prompt from signals
    const prompt = `
You are an SEO editor optimizing for Google Discover. Given page signals and the detected article text (truncated), provide:
1) 3 alternative, non-clickbait titles (≤ 68 chars) that maximize curiosity + clarity.
2) 2 opening intros (≤ 35 words) with a strong hook.
3) 3 lead image creative briefs (with subject, composition, setting; ≥1200px).
4) JSON-LD Article patch with headline, author, datePublished, dateModified, image.
5) A checklist of high-impact, concrete changes (max 10 items).

Page signals:
- Title: ${title || '(none)'}
- Description: ${desc || '(none)'}
- Author: ${authorName || ldAuthor || '(none)'}
- Dates: published=${pub || '(none)'} modified=${mod || '(none)'}
- Lead image: ${ogImage || ldImage || '(none)'}
- max-image-preview:large = ${/max-image-preview\s*:\s*large/i.test(maxPreview)}
- Word count: ${wordCount}; H2 count: ${h2Count}; TOC: ${!!hasTOC}
- Language: ${lang || '(none)'}
- Canonical: ${canonical || '(none)'}
- Intrusive UI signals: ads=${adLike}, overlays=${interstitialLike}

Article (first 1200 chars):
${bodyText.slice(0, 1200)}
`;

    // If you already use OpenAI elsewhere, reuse your wrapper.
    const apiKey = process.env.OPENAI_API_KEY;
    let ai: DiscoverReport['aiSuggestions'] | undefined = undefined;

    if (apiKey) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a senior SEO editor focused on Google Discover optimization.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        const text: string = j.choices?.[0]?.message?.content ?? '';
        // naive parse into buckets by headings (kept robust)
        const blocks = text.split(/\n{2,}/);
        const improvedTitle = blocks.filter(b => /title/i.test(b)).flatMap(b => b.split('\n')).filter(l => l.trim().startsWith('- ')).map(l => l.replace(/^- /,'').trim());
        const improvedIntro = blocks.filter(b => /intro/i.test(b)).flatMap(b => b.split('\n')).filter(l => l.trim().startsWith('- ')).map(l => l.replace(/^- /,'').trim());
        const imageBriefs = blocks.filter(b => /image/i.test(b)).flatMap(b => b.split('\n')).filter(l => l.trim().startsWith('- ')).map(l => l.replace(/^- /,'').trim());
        const checklist = blocks.filter(b => /checklist/i.test(b)).flatMap(b => b.split('\n')).filter(l => l.trim().startsWith('- ')).map(l => l.replace(/^- /,'').trim());

        // try to extract a JSON block for schema
        const jsonMatch = text.match(/```json([\s\S]*?)```/);
        let schemaPatch: any = undefined;
        if (jsonMatch) {
          try { schemaPatch = JSON.parse(jsonMatch[1]); } catch {}
        }

        ai = { improvedTitle, improvedIntro, imageBriefs, schemaPatch, checklist };
      }
    }

    const finalReport: DiscoverReport = { ...baseReport, aiSuggestions: ai };
    return new Response(JSON.stringify(finalReport), { status: 200 });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message || 'discover check failed' }), { status: 500 });
  }
}
