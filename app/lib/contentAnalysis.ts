// app/lib/contentAnalysis.ts
import { extractMainText, readabilityStats } from "@/lib/seo";

export type Language = "hi" | "en" | "other";

export type ContentPlagiarism = {
  enabled: boolean;
  method: "serpapi" | "heuristic" | "disabled";
  score: number | null; // 0..100 (100 = fully unique)
  sources: Array<{ url: string; title?: string; overlap?: number }>;
};

export type SeoOptimizationReport = {
  score: number; // 0..100
  topTerms: string[];
  checks: {
    titleIncludesTopTerm: boolean;
    h1IncludesTopTerm: boolean;
    metaDescriptionPresent: boolean;
    headingsStructure: boolean;
    imageAltCoverage: number; // 0..1
    internalLinkCount: number;
    keywordDensityTop: number; // 0..1
  };
  notes: string[];
};

export type SpamSignals = {
  score: number; // higher = more spammy (0..100)
  keywordStuffing: boolean;
  doorwayPattern: boolean;
  hiddenText: boolean;
  linkSpam: boolean;
  notes: string[];
};

export type IndexingSufficiency =
  | { level: "good"; reasons: string[] }
  | { level: "medium"; reasons: string[] }
  | { level: "low"; reasons: string[] };

export type ContentAnalysis = {
  language: Language;
  contentLength: number;
  readability: { words: number; sentences: number; readMinutes: number; flesch: number };
  indexing: IndexingSufficiency;
  plagiarism: ContentPlagiarism;
  seoOptimization: SeoOptimizationReport;
  spam: SpamSignals;
};

/* ---------------- language & tokenization ---------------- */

const HINDI_STOP = new Set([
  "के","की","का","एक","और","से","है","यह","थे","था","था","तो","पर","भी","में","को","तक","ही","जो","या","हो","गया","गई","कर","करना","करते","किया"
]);

const EN_STOP = new Set([
  "the","a","an","and","or","but","if","then","else","of","for","to","in","on","at","by","with","is","are","was","were","be","been","being","as","it","that","this","these","those","from","into","out","over","under","again","further","more","most","some","such"
]);

export function detectLanguage(text: string): Language {
  // crude but effective: Devanagari block = \u0900-\u097F
  const dev = (text.match(/[\u0900-\u097F]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  if (dev > Math.max(80, lat * 0.6)) return "hi";
  if (lat > 0) return "en";
  return "other";
}

export function tokenize(text: string, lang: Language): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const stop = lang === "hi" ? HINDI_STOP : EN_STOP;
  return words.filter((w) => !stop.has(w) && w.length > 2);
}

export function topTerms(text: string, lang: Language, k = 8): string[] {
  const freq: Record<string, number> = {};
  for (const w of tokenize(text, lang)) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([w]) => w);
}

export function densityOf(term: string, text: string): number {
  const toks = tokenize(text, detectLanguage(text));
  if (!toks.length) return 0;
  const hits = toks.filter((t) => t === term.toLowerCase()).length;
  return hits / toks.length;
}

/* ---------------- indexing sufficiency (heuristic) ---------------- */

export function indexingSufficiency(words: number): IndexingSufficiency {
  // There is no official word-count requirement; this is a pragmatic heuristic:
  if (words >= 800) return { level: "good", reasons: ["Substantial body copy (≥800 words)."] };
  if (words >= 300) return { level: "medium", reasons: ["Fair content length (300–799 words). Consider adding depth."] };
  return { level: "low", reasons: ["Thin content (<300 words) may struggle to rank or be indexed reliably."] };
}

/* ---------------- SEO optimization score ---------------- */

export function computeSeoOptimization(params: {
  text: string;
  title?: string;
  h1?: string;
  metaDescription?: string;
  images: { total: number; missingAlt: number };
  internalLinkCount: number;
}): SeoOptimizationReport {
  const lang = detectLanguage(params.text);
  const terms = topTerms(params.text, lang, 6);
  const top = terms[0] || "";
  const dens = top ? densityOf(top, params.text) : 0;
  const imageAltCoverage =
    params.images.total > 0 ? (params.images.total - params.images.missingAlt) / params.images.total : 1;

  const checks = {
    titleIncludesTopTerm: !!(params.title && top && params.title.toLowerCase().includes(top)),
    h1IncludesTopTerm: !!(params.h1 && top && params.h1.toLowerCase().includes(top)),
    metaDescriptionPresent: !!params.metaDescription,
    headingsStructure: true, // you can pass a more detailed flag if you compute it elsewhere
    imageAltCoverage,
    internalLinkCount: params.internalLinkCount,
    keywordDensityTop: dens,
  };

  let score = 100;
  const notes: string[] = [];
  if (!checks.titleIncludesTopTerm) { score -= 8; notes.push("Top term not present in <title>."); }
  if (!checks.h1IncludesTopTerm) { score -= 6; notes.push("Top term not present in H1."); }
  if (!checks.metaDescriptionPresent) { score -= 6; notes.push("Missing meta description."); }
  if (imageAltCoverage < 0.7) { score -= 8; notes.push("Low image alt coverage."); }
  if (params.internalLinkCount < 3) { score -= 4; notes.push("Few internal links on page."); }
  if (dens > 0.07) { score -= 10; notes.push("Keyword density high; may appear stuffed."); }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, topTerms: terms, checks, notes };
}

/* ---------------- spam signals (heuristics) ---------------- */

export function detectSpamSignals(params: {
  text: string;
  html: string;
  linkCount: number;
  topDensity: number;
}): SpamSignals {
  const notes: string[] = [];
  let score = 0;

  // Keyword stuffing
  const stuffing = params.topDensity > 0.09;
  if (stuffing) { score += 35; notes.push("High keyword density (possible stuffing)."); }

  // Link spam
  const linkSpam = params.linkCount > 400;
  if (linkSpam) { score += 20; notes.push("Excessive number of links on the page."); }

  // Hidden text (basic)
  const hiddenText = /style\s*=\s*"(?:[^"]*display\s*:\s*none|[^"]*font-size\s*:\s*0)/i.test(params.html);
  if (hiddenText) { score += 25; notes.push("Hidden text detected in inline styles."); }

  // Doorway pattern (city/keyword lists repeated)
  const doorway = /(near\s+me|best\s+\w+\s+in\s+\w+[, ]+\w+[, ]+\w+)/i.test(params.text);
  if (doorway) { score += 15; notes.push("Doorway-like pattern detected (generic location/keyword lists)."); }

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    keywordStuffing: stuffing,
    doorwayPattern: doorway,
    hiddenText,
    linkSpam,
    notes,
  };
}

/* ---------------- plagiarism (SERP API optional) ---------------- */

async function serpapiSnippetCheck(snippets: string[], apiKey: string) {
  const results: Array<{ url: string; title?: string; overlap?: number }> = [];
  for (const snip of snippets) {
    const q = `"${snip}"`; // exact phrase
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&num=5&hl=en&api_key=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) continue;
    const json = await r.json();
    const org = json?.organic_results || [];
    for (const o of org) {
      if (o.link) results.push({ url: o.link, title: o.title, overlap: snip.length });
    }
    // be polite: tiny delay
    await new Promise((res) => setTimeout(res, 250));
  }
  return results;
}

/** Pick K mid-length snippets from the text */
export function sampleSnippets(text: string, k = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const len = words.length;
  if (len < 40) return [];
  const picks: string[] = [];
  for (let i = 0; i < k; i++) {
    const start = Math.max(5, Math.floor((len / (k + 1)) * (i + 1)) - 10);
    const slice = words.slice(start, start + 12).join(" ");
    if (slice.length > 20) picks.push(slice);
  }
  return picks;
}

export async function checkPlagiarism(text: string): Promise<ContentPlagiarism> {
  const apiKey = process.env.SERPAPI_KEY || process.env.GOOGLE_API_KEY; // whichever you use
  const snippets = sampleSnippets(text, 3);

  if (!snippets.length) {
    return { enabled: false, method: "disabled", score: null, sources: [] };
  }

  if (!apiKey) {
    // heuristic uniqueness: no external search → assume medium uniqueness
    return { enabled: false, method: "heuristic", score: 70, sources: [] };
  }

  try {
    const hits = await serpapiSnippetCheck(snippets, apiKey);
    // crude uniqueness score: fewer external matches → higher uniqueness
    const matchPenalty = Math.min(70, hits.length * 15);
    const score = Math.max(0, 100 - matchPenalty);
    return { enabled: true, method: "serpapi", score, sources: hits.slice(0, 10) };
  } catch {
    return { enabled: false, method: "heuristic", score: 70, sources: [] };
  }
}

/* ---------------- main entry ---------------- */

export async function runContentAnalysis(params: {
  html: string;
  url: string;
  title?: string;
  h1?: string;
  metaDescription?: string;
  images: { total: number; missingAlt: number };
  internalLinkCount: number;
}): Promise<ContentAnalysis> {
  const { text } = extractMainText(params.html);
  const lang = detectLanguage(text);
  const read = readabilityStats(text);
  const idx = indexingSufficiency(read.words);

  const seoOpt = computeSeoOptimization({
    text,
    title: params.title,
    h1: params.h1,
    metaDescription: params.metaDescription,
    images: params.images,
    internalLinkCount: params.internalLinkCount,
  });

  const top = seoOpt.topTerms[0] || "";
  const spam = detectSpamSignals({
    text,
    html: params.html,
    linkCount: params.internalLinkCount, // page-wide link count would be better; we pass internal as proxy
    topDensity: top ? densityOf(top, text) : 0,
  });

  const plagiarism = await checkPlagiarism(text);

  return {
    language: lang,
    contentLength: read.words,
    readability: read,
    indexing: idx,
    plagiarism,
    seoOptimization: seoOpt,
    spam,
  };
}
