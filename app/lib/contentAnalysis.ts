// app/lib/contentAnalysis.ts
import * as cheerio from "cheerio";
import { extractMainText, readabilityStats } from "@/lib/seo";

/* ===================== Types ===================== */

export type Language = "hi" | "en" | "other";

export type ContentPlagiarism = {
  enabled: boolean;
  method: "serpapi" | "heuristic" | "disabled";
  score: number | null; // 0..100 (100 = fully unique)
  sources: Array<{ url: string; title?: string; overlap?: number }>;
};

export type AuthorInfo = {
  name?: string;
  url?: string;
  sameAs?: string[];
  sources: string[]; // e.g. ['jsonld:Article.author', 'meta[name=author]']
};

export type PublisherInfo = {
  name?: string;
  logo?: string;
  url?: string;
  sameAs?: string[];
  sources: string[];
};

export type PolicyHints = {
  hasEditorialPolicy: boolean;
  hasCorrectionsPolicy: boolean;
  hasFactCheckingPolicy: boolean;
  hasReviewByline: boolean; // "Reviewed by ...", "Medically reviewed by ..."
  foundUrls: string[];      // any matching policy/about/contact links we saw
};

export type EATSignals = {
  hasAuthorByline: boolean;
  hasPublishedDate: boolean;
  hasUpdatedDate: boolean;
  hasContactOrAbout: boolean;
  schemaHints: {
    hasArticle: boolean;
    hasOrganization: boolean;
    hasPerson: boolean;
    hasWebSite?: boolean;
    hasProfilePage?: boolean;
    hasBreadcrumb?: boolean;
  };

  author?: AuthorInfo;
  publisher?: PublisherInfo;
  publishedISO?: string | null;
  modifiedISO?: string | null;
  policyHints?: PolicyHints;

  who?: string | null; // simple provenance text
  how?: string | null;
  why?: string | null;
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

  // expose E-E-A-T so UI can render details
  eat: EATSignals;

  // (Optional) if you later wire AI:
  // aiAssessment?: AiEeatAssessment;
};

/* ========== Language & tokenization helpers ========== */

const HINDI_STOP = new Set([
  "के","की","का","एक","और","से","है","यह","थे","था","तो","पर","भी","में","को","तक","ही","जो","या","हो","गया","गई","कर","करना","करते","किया"
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

/* ================ Indexing sufficiency ================ */

export function indexingSufficiency(words: number): IndexingSufficiency {
  // Not official; pragmatic heuristic:
  if (words >= 800) return { level: "good", reasons: ["Substantial body copy (≥800 words)."] };
  if (words >= 300) return { level: "medium", reasons: ["Fair content length (300–799 words). Consider adding depth."] };
  return { level: "low", reasons: ["Thin content (<300 words) may struggle to rank or be indexed reliably."] };
}

/* ================ SEO optimization score ================ */

const SCORE_DEDUCTIONS = {
  TITLE_TOP_TERM: 8,
  H1_TOP_TERM: 6,
  META_DESCRIPTION: 6,
  IMAGE_ALT: 8,
  INTERNAL_LINKS: 4,
  KEYWORD_STUFFING: 10,
  EAT_AUTHOR_BYLINE: 3,
  EAT_PUBLISHED_DATE: 2,
  EAT_CONTACT_ABOUT: 2,
  EAT_SCHEMA: 2,
} as const;

const THRESHOLDS = {
  IMAGE_ALT_COVERAGE: 0.7,
  MIN_INTERNAL_LINKS: 3,
  KEYWORD_DENSITY_STUFFING: 0.07,
} as const;

export function computeSeoOptimization(params: {
  text: string;
  title?: string;
  h1?: string;
  metaDescription?: string;
  images: { total: number; missingAlt: number };
  internalLinkCount: number;
  eat: EATSignals;
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
    headingsStructure: true, // you can enrich later
    imageAltCoverage,
    internalLinkCount: params.internalLinkCount,
    keywordDensityTop: dens,
  };

  let score = 100;
  const notes: string[] = [];

  // Standard SEO checks
  if (!checks.titleIncludesTopTerm) { score -= SCORE_DEDUCTIONS.TITLE_TOP_TERM; notes.push("Top term not present in <title>."); }
  if (!checks.h1IncludesTopTerm) { score -= SCORE_DEDUCTIONS.H1_TOP_TERM; notes.push("Top term not present in H1."); }
  if (!checks.metaDescriptionPresent) { score -= SCORE_DEDUCTIONS.META_DESCRIPTION; notes.push("Missing meta description."); }
  if (imageAltCoverage < THRESHOLDS.IMAGE_ALT_COVERAGE) { score -= SCORE_DEDUCTIONS.IMAGE_ALT; notes.push("Low image alt coverage."); }
  if (params.internalLinkCount < THRESHOLDS.MIN_INTERNAL_LINKS) { score -= SCORE_DEDUCTIONS.INTERNAL_LINKS; notes.push("Few internal links on page."); }
  if (dens > THRESHOLDS.KEYWORD_DENSITY_STUFFING) { score -= SCORE_DEDUCTIONS.KEYWORD_STUFFING; notes.push("Keyword density high; may appear stuffed."); }

  // E-E-A-T nudges (soft)
  const eat = params.eat;
  if (!eat.hasAuthorByline) { score -= SCORE_DEDUCTIONS.EAT_AUTHOR_BYLINE; notes.push("Add an author byline or profile."); }
  if (!eat.hasPublishedDate) { score -= SCORE_DEDUCTIONS.EAT_PUBLISHED_DATE; notes.push("Show a published date."); }
  if (!eat.hasContactOrAbout) { score -= SCORE_DEDUCTIONS.EAT_CONTACT_ABOUT; notes.push("Link to About/Contact pages."); }
  if (!eat.schemaHints.hasArticle && !eat.schemaHints.hasOrganization) {
    score -= SCORE_DEDUCTIONS.EAT_SCHEMA; notes.push("Add Article/Organization structured data.");
  }
  if (eat.policyHints?.hasCorrectionsPolicy === false) {
    notes.push("Consider adding a corrections policy for accountability.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, topTerms: terms, checks, notes };
}

/* ================= Spam signals (heuristics) ================= */

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

  // Doorway pattern (very rough)
  const doorway = /(near\s+me|best\s+\w+\s+in\s+\w+[, ]+\w+[, ]+\w+)/i.test(params.text);
  if (doorway) { score += 15; notes.push("Doorway-like pattern detected (generic location/keyword lists)."); }

  score = Math.max(0, Math.min(100, score));
  return { score, keywordStuffing: stuffing, doorwayPattern: doorway, hiddenText, linkSpam, notes };
}

/* ================= Plagiarism (SERP API optional) ================= */

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
  const apiKey = process.env.SERPAPI_KEY || process.env.GOOGLE_API_KEY;
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

/* ================= JSON-LD helpers ================= */

function readJsonLd($: cheerio.CheerioAPI): any[] {
  const blocks: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).text();
    if (!txt) return;
    try { blocks.push(JSON.parse(txt)); } catch { /* ignore invalid */ }
  });
  return blocks;
}

function collectArray<T>(x: T | T[] | undefined | null): T[] {
  return x == null ? [] : (Array.isArray(x) ? x : [x]);
}

function asString(x: any): string | undefined {
  return typeof x === "string" ? x.trim() : undefined;
}

function normalizeSameAs(x: any): string[] {
  return collectArray(x).map(asString).filter(Boolean) as string[];
}

function extractAuthorFromNode(node: any, source: string): AuthorInfo | undefined {
  if (!node) return;
  const a = Array.isArray(node) ? node[0] : node;
  const name = asString(a?.name) || asString(a);
  const url  = asString(a?.url);
  const sameAs = normalizeSameAs(a?.sameAs);
  if (name || url || sameAs.length) {
    return { name, url, sameAs, sources: [source] };
  }
}

function extractPublisherFromNode(node: any, source: string): PublisherInfo | undefined {
  if (!node) return;
  const p = Array.isArray(node) ? node[0] : node;
  const name = asString(p?.name);
  const url  = asString(p?.url);
  const logo = asString(p?.logo?.url) || asString(p?.logo);
  const sameAs = normalizeSameAs(p?.sameAs);
  if (name || url || logo || sameAs.length) {
    return { name, url, logo, sameAs, sources: [source] };
  }
}

/* ================= Main entry ================= */

export async function runContentAnalysis(params: {
  html: string;
  url: string;
  title?: string;
  h1?: string;
  metaDescription?: string;
  images: { total: number; missingAlt: number };
  internalLinkCount: number;
}): Promise<ContentAnalysis> {
  const $ = cheerio.load(params.html);
  const { text } = extractMainText(params.html);
  const lang = detectLanguage(text);
  const read = readabilityStats(text);
  const idx = indexingSufficiency(read.words);

  // -------- E-E-A-T detection & enrichment --------
  const jsonld = readJsonLd($);

  // schema flags
  let hasArticle = false, hasOrganization = false, hasPerson = false;
  let hasWebSite = false, hasProfilePage = false, hasBreadcrumb = false;

  let author: AuthorInfo | undefined;
  let publisher: PublisherInfo | undefined;
  let publishedISO: string | null = null;
  let modifiedISO: string | null = null;

  // Walk JSON-LD graph(s)
  const walk = (node: any) => {
    if (!node) return;
    const arr = collectArray(node);
    for (const n of arr) {
      if (typeof n !== "object") continue;
      const types = collectArray(n["@type"]).map(String);

      if (types.some(t => /Article|NewsArticle|BlogPosting/i.test(t))) {
        hasArticle = true;
        author ||= extractAuthorFromNode(n.author || n.creator, "jsonld:Article.author");
        publisher ||= extractPublisherFromNode(n.publisher, "jsonld:Article.publisher");
        publishedISO ||= asString(n.datePublished) || null;
        modifiedISO  ||= asString(n.dateModified)  || null;
      }
      if (types.some(t => /Organization/i.test(t))) {
        hasOrganization = true;
        publisher ||= extractPublisherFromNode(n, "jsonld:Organization");
      }
      if (types.some(t => /Person/i.test(t))) {
        hasPerson = true;
        author ||= extractAuthorFromNode(n, "jsonld:Person");
      }
      if (types.some(t => /WebSite/i.test(t)))   hasWebSite = true;
      if (types.some(t => /ProfilePage/i.test(t))) hasProfilePage = true;
      if (types.some(t => /BreadcrumbList/i.test(t))) hasBreadcrumb = true;

      // recurse
      for (const v of Object.values(n)) walk(v);
    }
  };
  jsonld.forEach(walk);

  // Meta/OG fallbacks
  if (!author) {
    const metaAuthor = $('meta[name="author"]').attr('content');
    if (metaAuthor) author = { name: metaAuthor.trim(), sources: ['meta[name=author]'] };
  }
  if (!author?.url) {
    const ogAuthor = $('meta[property="article:author"]').attr('content');
    if (ogAuthor) author = { ...(author||{sources:[]}), url: ogAuthor, sources: [ ...(author?.sources||[]), 'og:article:author' ] };
  }
  if (!publishedISO) {
    publishedISO = $('meta[property="article:published_time"]').attr('content')
               || $('time[datetime]').attr('datetime')
               || null;
  }
  if (!modifiedISO) {
    modifiedISO = $('meta[property="article:modified_time"]').attr('content')
              || $('time[datetime*="update"]').attr('datetime')
              || null;
  }

  // Byline heuristics
  const hasAuthorByline =
    !!author?.name ||
    $('[rel="author"], .author, .byline, [itemprop="author"]').length > 0;

  // About / Contact presence (site-level trust)
  const aboutLinks = $('a[href*="about"]').map((_,el)=>$(el).attr('href')||'').get();
  const contactLinks = $('a[href*="contact"]').map((_,el)=>$(el).attr('href')||'').get();
  const hasContactOrAbout = (aboutLinks.length + contactLinks.length) > 0;

  // policy pages / responsibility signals
  const editorialLinks = $('a[href*="editorial"], a[href*="ethic"]').map((_,el)=>$(el).attr('href')||'').get();
  const correctionsLinks = $('a[href*="correction"]').map((_,el)=>$(el).attr('href')||'').get();
  const factcheckLinks   = $('a[href*="fact"]').map((_,el)=>$(el).attr('href')||'').get();
  const reviewByline = /reviewed by|medically reviewed by/i.test($('body').text());

  const policyHints: PolicyHints = {
    hasEditorialPolicy: editorialLinks.length > 0,
    hasCorrectionsPolicy: correctionsLinks.length > 0,
    hasFactCheckingPolicy: factcheckLinks.length > 0,
    hasReviewByline: reviewByline,
    foundUrls: [...new Set([...aboutLinks, ...contactLinks, ...editorialLinks, ...correctionsLinks, ...factcheckLinks])].slice(0, 25),
  };

  // schema hints bundle
  const schemaHints = {
    hasArticle, hasOrganization, hasPerson, hasWebSite, hasProfilePage, hasBreadcrumb
  };

  // “Who/How/Why” cheap provenance
  const who = author?.name || publisher?.name || null;
  const how = ($('body').text().match(/original research|expert review|case study|hands-on/i)?.[0]) || null;
  const why = ($('body').text().match(/help|guide|tutorial|overview|review/i)?.[0]) || null;

  const eat: EATSignals = {
    hasAuthorByline,
    hasPublishedDate: !!publishedISO,
    hasUpdatedDate: !!modifiedISO,
    hasContactOrAbout,
    schemaHints,
    author,
    publisher,
    publishedISO,
    modifiedISO,
    policyHints,
    who, how, why,
  };

  // SEO optimization (now includes E-E-A-T nudges)
  const seoOpt = computeSeoOptimization({
    text,
    title: params.title,
    h1: params.h1,
    metaDescription: params.metaDescription,
    images: params.images,
    internalLinkCount: params.internalLinkCount,
    eat
  });

  const top = seoOpt.topTerms[0] || "";
  const spam = detectSpamSignals({
    text,
    html: params.html,
    linkCount: params.internalLinkCount, // page-wide link count would be better; internal used as proxy
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
    eat, // <-- important: return E-E-A-T for UI/AI steps
  };
}
