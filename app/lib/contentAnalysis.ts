// lib/contentAnalysis.ts
import * as cheerio from "cheerio";
import { extractMainText, readabilityStats } from "@/lib/seo";

/** ---------------- Types ---------------- */
export type Language = "en" | "hi" | "other";

export type DensityStat = {
  term: string;
  count: number;
  densityPct: number; // 0..100
};

export type ContentSignals = {
  language: Language;
  langConfidence: number; // 0..1
  wordCount: number;
  sentences: number;
  readMinutes: number;
  flesch: number;
  headings: {
    h1?: string | null;
    h2Count: number;
    h3Count: number;
  };
  primaryKeyword?: string | null;
  keywordCandidates: string[];
  keywordDensityTop: DensityStat[];
  internalLinkCount: number;
  imageCount?: number;
  imagesMissingAlt?: number;
};

export type SpamSignals = {
  keywordStuffing: boolean;
  stuffingTerms?: DensityStat[];
  hiddenText: { found: boolean; samples: string[] };
  doorwayPattern: boolean;
  aggressiveAffiliateFootprint: boolean;
  exactMatchAnchorOveruse: boolean;
};

export type EATSignals = {
  hasAuthorByline: boolean;
  hasPublishedDate: boolean;
  hasUpdatedDate: boolean;
  hasContactOrAbout: boolean;
  schemaHints: {
    hasArticle: boolean;
    hasOrganization: boolean;
  };
};

export type LengthGuidance = {
  meetsMinimum: boolean;
  recommendedMin: number;
  actual: number;
};

export type PlagiarismResult = {
  mode: "local" | "provider" | "disabled";
  score?: number; // 0..1 (1 identical). Lower is better for external matches
  notes: string[];
};

export type ContentOptimizationScore = {
  score: number; // 0..100
  rationale: string[];
};

export type ContentAnalysisResult = {
  signals: ContentSignals;
  spam: SpamSignals;
  eat: EATSignals;
  lengthGuidance: LengthGuidance;
  plagiarism: PlagiarismResult;
  optimization: ContentOptimizationScore;
  suggestions: Array<{ severity: "high" | "medium" | "low"; text: string }>;
};

/** --------------- Helpers --------------- */

// Light language detection (Devanagari vs Latin + stopwords)
const HI_STOP = new Set([
  "और","है","था","थी","थे","की","के","को","में","पर","से","एक","यह","ये","उन","उस","इस","या","तो","ही","भी"
]);
const EN_STOP = new Set([
  "the","and","a","an","of","to","in","for","on","is","are","was","were","it","that","as","with","by","from","at","or"
]);

function detectLanguageTokens(text: string): { lang: Language; conf: number } {
  // Count Unicode blocks
  let dev = 0, lat = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) || 0;
    if (code >= 0x0900 && code <= 0x097F) dev++;       // Devanagari block
    if ((code >= 0x0041 && code <= 0x007A) || (code >= 0x00C0 && code <= 0x024F)) lat++;
  }
  const words = text.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 2000);
  let hiStop = 0, enStop = 0;
  for (const w of words) {
    if (HI_STOP.has(w)) hiStop++;
    if (EN_STOP.has(w)) enStop++;
  }

  // Combine signals (script + stopwords)
  const devWeight = dev / Math.max(1, dev + lat);
  const stopWeightHi = hiStop / Math.max(1, hiStop + enStop);

  if (devWeight > 0.3 || stopWeightHi > 0.55) {
    const conf = Math.min(1, 0.6 * devWeight + 0.4 * stopWeightHi + 0.15);
    return { lang: "hi", conf };
  }
  const enConf = Math.min(1, 0.7 * (1 - devWeight) + 0.3 * (enStop / Math.max(1, words.length/8)));
  if (enConf > 0.45) return { lang: "en", conf: enConf };
  return { lang: "other", conf: 0.4 };
}

// Basic tokenizer with language-aware stopwords
function tokenize(text: string, lang: Language): string[] {
  const stop = lang === "hi" ? HI_STOP : lang === "en" ? EN_STOP : new Set<string>();
  return text
    .toLowerCase()
    .replace(/[\u0964\u0965]/g, " ") // Hindi danda cleanup
    .replace(/[^a-z\u0900-\u097F0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter(w => w && !stop.has(w) && w.length > 1);
}

function topTerms(tokens: string[], n = 20): Array<{ term: string; count: number }> {
  const f = new Map<string, number>();
  for (const t of tokens) f.set(t, (f.get(t) || 0) + 1);
  return [...f.entries()]
    .sort((a,b)=> b[1] - a[1])
    .slice(0, n)
    .map(([term, count]) => ({ term, count }));
}

function ngrams(arr: string[], n: 2|3 = 2, max = 20) {
  const f = new Map<string, number>();
  for (let i=0;i<=arr.length-n;i++){
    const g = arr.slice(i, i+n).join(" ");
    f.set(g, (f.get(g)||0)+1);
  }
  return [...f.entries()].sort((a,b)=>b[1]-a[1]).slice(0, max).map(([term,count])=>({term,count}));
}

function densityOf(term: string, tokens: string[]): number {
  const total = Math.max(1, tokens.length);
  const count = tokens.filter(t => t === term).length;
  return (count / total) * 100;
}

function guessPrimaryKeyword(title?: string|null, h1?: string|null, lang: Language = "en") {
  const src = [title||"", h1||""].join(" ").trim();
  if (!src) return null;
  const toks = tokenize(src, lang);
  // prefer bigrams if they appear
  const bigs = ngrams(toks, 2, 10);
  if (bigs.length && bigs[0].count >= 1) return bigs[0].term;
  const tops = topTerms(toks, 1);
  return tops[0]?.term || null;
}

/** Hidden text quick heuristics (inline styles only, safe for SSR) */
function detectHiddenInline($: cheerio.CheerioAPI) {
  const samples: string[] = [];
  $('[style]').each((_, el) => {
    const style = String($(el).attr("style") || "").toLowerCase();
    const text = $(el).text().trim().slice(0, 120);
    const isHidden =
      /display\s*:\s*none/.test(style) ||
      /visibility\s*:\s*hidden/.test(style) ||
      /opacity\s*:\s*0(\.0+)?\b/.test(style) ||
      /font-size\s*:\s*0(px|rem|em)?\b/.test(style) ||
      /position\s*:\s*absolute/.test(style) && /left\s*:-?9999px/.test(style);

    if (isHidden && text) {
      if (samples.length < 5) samples.push(text);
    }
  });
  return { found: samples.length > 0, samples };
}

/** Doorway-ish pattern: pages with long lists of near-identical internal links */
function detectDoorway($: cheerio.CheerioAPI, origin: URL) {
  let similar = 0;
  const anchors = $("a[href]").toArray().slice(0, 400);
  for (const a of anchors) {
    const $a = $(a);
    const href = $a.attr("href") || "";
    const text = $a.text().trim().toLowerCase();
    if (!href || !text) continue;
    try {
      const u = new URL(href, origin);
      if (u.origin === origin.origin) {
        // many anchors that are the same or contain only a location/param variation
        if (/^(buy|best|cheap|price|deal|hotel|flight|service)/.test(text) || /(\bvs\b|\bnear\b)/.test(text)) {
          similar++;
        }
      }
    } catch {}
  }
  return similar > 25; // heuristic
}

/** Exact-match anchor overuse (EMD anchors) */
function detectExactMatchAnchors($: cheerio.CheerioAPI, primary?: string|null) {
  if (!primary) return false;
  const p = primary.toLowerCase();
  const anchors = $("a[href]").toArray().slice(0, 500);
  let emd = 0;
  for (const a of anchors) {
    const text = $(a).text().trim().toLowerCase();
    if (text === p) emd++;
  }
  return emd >= 10; // heuristic
}

/** Affiliate/ads footprint (very rough heuristics) */
function detectAffiliateFootprint(html: string) {
  const markers = [
    "utm_source=aff",
    "utm_medium=affiliate",
    "affid=",
    "aid=",
    "ref=",
    "amazon-adsystem",
    "adsbygoogle",
    "widget-affiliate",
  ];
  const hits = markers.reduce((acc, m)=> acc + (html.includes(m) ? 1 : 0), 0);
  return hits >= 2;
}

/** Optional provider hook for external plagiarism check (stub) */
async function externalPlagiarismCheck(_text: string): Promise<PlagiarismResult> {
  // Implement with your provider of choice (e.g., Serp/Bing API) using env keys.
  // Return a conservative stub by default.
  return {
    mode: "disabled",
    notes: ["External plagiarism provider not configured."],
  };
}

/** --------------- Main API --------------- */
export async function runContentAnalysis(params: {
  html: string;
  url: string;
  title?: string | null;
  h1?: string | null;
  metaDescription?: string | null;
  images?: { total?: number; missingAlt?: number };
  internalLinkCount?: number;
}): Promise<ContentAnalysisResult> {
  const { html, url, title, h1, metaDescription, images, internalLinkCount = 0 } = params;
  const $ = cheerio.load(html);
  const { text, words } = extractMainText(html);
  const read = readabilityStats(text);

  const { lang, conf } = detectLanguageTokens(text);
  const tokens = tokenize(text, lang);
  const terms = topTerms(tokens, 30);
  const bi = ngrams(tokens, 2, 15);
  const tri = ngrams(tokens, 3, 10);

  const primaryKeyword = guessPrimaryKeyword(title, h1, lang);
  const densityList: DensityStat[] = terms.slice(0, 10).map(({ term, count }) => ({
    term,
    count,
    densityPct: Number(densityOf(term, tokens).toFixed(2)),
  }));

  // Heading counts
  const h2Count = $("h2").length;
  const h3Count = $("h3").length;

  // Length recommendation (heuristics vary slightly by language)
  const recommendedMin = lang === "hi" ? 350 : 300; // tweak as you like
  const lengthGuidance: LengthGuidance = {
    meetsMinimum: words >= recommendedMin,
    recommendedMin,
    actual: words,
  };

  // Spam signals
  const stuffingTerms = densityList.filter(d => d.densityPct >= 4.5); // >~4.5% is suspicious
  const keywordStuffing = stuffingTerms.length >= 2 || (stuffingTerms[0]?.densityPct || 0) >= 7.5;
  const hiddenText = detectHiddenInline($);
  const doorwayPattern = detectDoorway($, new URL(url));
  const exactMatchAnchorOveruse = detectExactMatchAnchors($, primaryKeyword);
  const aggressiveAffiliateFootprint = detectAffiliateFootprint(html);

  // E-E-A-T signals
  const hasAuthorByline = $('[itemprop="author"], .author, .byline, meta[name="author"]').length > 0;
  const hasPublishedDate = $('[itemprop="datePublished"], time[datetime], meta[name="date"]').length > 0;
  const hasUpdatedDate = $('[itemprop="dateModified"], time[datetime*="update"]').length > 0;
  const hasContactOrAbout = $('a[href*="contact"], a[href*="about"]').length > 0 || $('footer').text().toLowerCase().includes("contact");

  const schemaJson = $('script[type="application/ld+json"]').map((_, el)=>$(el).text()).get().join("\n");
  const schemaHints = {
    hasArticle: /"@type"\s*:\s*"(Article|NewsArticle|BlogPosting)"/i.test(schemaJson),
    hasOrganization: /"@type"\s*:\s*"Organization"/i.test(schemaJson),
  };

  // Plagiarism (stubbed; add provider later)
  const plagiarism = await externalPlagiarismCheck(text);

  // Optimization scoring (simple heuristics)
  const rationale: string[] = [];
  let score = 100;

  if (!lengthGuidance.meetsMinimum) { score -= 10; rationale.push("Content length below recommended minimum."); }
  if (read.flesch && read.flesch < 45) { score -= 6; rationale.push("Reading ease is quite hard (Flesch < 45)."); }
  if (primaryKeyword) {
    const pkDensity = Number(densityOf(primaryKeyword, tokens).toFixed(2));
    if (pkDensity < 0.2) { score -= 4; rationale.push("Primary topic scarcely present in body text."); }
    if (pkDensity > 5) { score -= 8; rationale.push("Primary topic density looks excessive; avoid stuffing."); }
    if (title && !title.toLowerCase().includes(primaryKeyword)) { score -= 4; rationale.push("Primary topic absent from title."); }
    if (h1 && !h1.toLowerCase().includes(primaryKeyword)) { score -= 3; rationale.push("Primary topic absent from H1."); }
    if (metaDescription && !metaDescription.toLowerCase().includes(primaryKeyword)) { score -= 2; rationale.push("Primary topic absent from meta description."); }
  } else {
    score -= 5; rationale.push("Could not infer a primary topic from title/H1.");
  }
  if (h2Count < 1) { score -= 3; rationale.push("No H2 sections — consider a clearer outline."); }
  if ((images?.missingAlt || 0) > 0) { score -= Math.min(4, images!.missingAlt!); rationale.push("Images missing alt text."); }
  if (internalLinkCount < 3) { score -= 3; rationale.push("Few internal links — add contextual links to related pages."); }

  // Spam penalties
  if (keywordStuffing) { score -= 12; rationale.push("Keyword stuffing suspected."); }
  if (hiddenText.found) { score -= 15; rationale.push("Hidden text styles detected."); }
  if (doorwayPattern) { score -= 10; rationale.push("Doorway-like link pattern."); }
  if (exactMatchAnchorOveruse) { score -= 6; rationale.push("Exact-match anchor overuse."); }
  if (aggressiveAffiliateFootprint) { score -= 5; rationale.push("Aggressive affiliate/ads footprint."); }

  const optimization: ContentOptimizationScore = {
    score: Math.max(0, Math.min(100, Math.round(score))),
    rationale,
  };

  // Suggestions (prioritized)
  const suggestions: Array<{ severity: "high"|"medium"|"low"; text: string }> = [];

  if (!lengthGuidance.meetsMinimum)
    suggestions.push({ severity: "high", text: `Increase content to at least ~${lengthGuidance.recommendedMin} words for better indexability.` });

  if (keywordStuffing)
    suggestions.push({ severity: "high", text: "Reduce repeated exact terms; rewrite with synonyms and natural phrasing to avoid keyword stuffing." });

  if (hiddenText.found)
    suggestions.push({ severity: "high", text: "Remove hidden text styles (display:none, opacity:0, font-size:0, off-screen). Keep content visible for users." });

  if (doorwayPattern)
    suggestions.push({ severity: "medium", text: "Consolidate near-identical internal links. Avoid doorway-like pages with repetitive variants." });

  if (exactMatchAnchorOveruse)
    suggestions.push({ severity: "medium", text: "Diversify anchor text; avoid repeating the exact keyword for many internal links." });

  if (primaryKeyword && title && !title.toLowerCase().includes(primaryKeyword))
    suggestions.push({ severity: "medium", text: `Include primary topic “${primaryKeyword}” naturally in the title.` });

  if (primaryKeyword && h1 && !h1.toLowerCase().includes(primaryKeyword))
    suggestions.push({ severity: "medium", text: `Include primary topic “${primaryKeyword}” in the H1 if it reads naturally.` });

  if (primaryKeyword && metaDescription && !metaDescription.toLowerCase().includes(primaryKeyword))
    suggestions.push({ severity: "low", text: `Weave primary topic “${primaryKeyword}” into the meta description (avoid keyword stuffing).` });

  if (h2Count < 1)
    suggestions.push({ severity: "low", text: "Add at least one H2 section to structure the content." });

  if ((images?.missingAlt || 0) > 0)
    suggestions.push({ severity: "low", text: "Add descriptive alt text to images to improve accessibility and topical signals." });

  if (internalLinkCount < 3)
    suggestions.push({ severity: "low", text: "Add 3–5 contextual internal links to relevant pages to strengthen topical clusters." });

  if (!hasAuthorByline || !hasPublishedDate)
    suggestions.push({ severity: "low", text: "Add author byline and publish date; include About/Contact to reinforce E-E-A-T." });

  const result: ContentAnalysisResult = {
    signals: {
      language: lang,
      langConfidence: Number(conf.toFixed(2)),
      wordCount: words,
      sentences: read.sentences,
      readMinutes: read.readMinutes,
      flesch: read.flesch,
      headings: { h1: h1 || null, h2Count, h3Count },
      primaryKeyword,
      keywordCandidates: [
        ...terms.slice(0, 10).map(t => t.term),
        ...bi.slice(0, 5).map(t => t.term),
        ...tri.slice(0, 3).map(t => t.term),
      ],
      keywordDensityTop: densityList,
      internalLinkCount,
      imageCount: images?.total,
      imagesMissingAlt: images?.missingAlt,
    },
    spam: {
      keywordStuffing,
      stuffingTerms,
      hiddenText,
      doorwayPattern,
      exactMatchAnchorOveruse,
      aggressiveAffiliateFootprint,
    },
    eat: {
      hasAuthorByline,
      hasPublishedDate,
      hasUpdatedDate,
      hasContactOrAbout,
      schemaHints,
    },
    lengthGuidance,
    plagiarism: plagiarism,
    optimization,
    suggestions,
  };

  return result;
}
