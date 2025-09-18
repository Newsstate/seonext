// app/lib/aiEeat.ts
export type AIEEATVerdict = "strong" | "okay" | "weak";

export type AIEEAT = {
  verdict: AIEEATVerdict;
  overall: number;                 // 0..100
  reasons: string[];
  riskFlags?: string[];
  author?: { score?: number; evidence?: string[] };
  dates?: { score?: number; evidence?: string[] };
  organization?: { score?: number; evidence?: string[] };
  policies?: { score?: number; evidence?: string[] };
};

type CallModel = (p: { system: string; user: string }) => Promise<string>;

export async function runAIEEAT(opts: {
  url: string;
  htmlExcerpt: string;   // ~8–12k chars is enough
  facts: any;            // structured facts: schema, robots, detected E-E-A-T hints
  callModel: CallModel;  // model shim
}): Promise<AIEEAT> {
  const system = [
    "You are an E-E-A-T auditor for web content.",
    "Return a SINGLE JSON object only, no markdown, no commentary.",
    "Fields: verdict('strong'|'okay'|'weak'), overall(0..100), reasons[string[]],",
    "riskFlags[string[]], author{score,evidence[]}, dates{score,evidence[]},",
    "organization{score,evidence[]}, policies{score,evidence[]}.",
    "Be conservative; do not invent facts that aren't in excerpt/facts."
  ].join(" ");

  const user = JSON.stringify({
    task: "Assess E-E-A-T strength of this page.",
    url: opts.url,
    excerpt: opts.htmlExcerpt,
    facts: opts.facts
  });

  const raw = await opts.callModel({ system, user });

  // Perplexity returns text; make sure it's JSON we can parse
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Some models wrap JSON in backticks; try to salvage
    const m = raw.match(/\{[\s\S]*\}$/);
    parsed = m ? JSON.parse(m[0]) : null;
  }

  // Fallback shape if something goes wrong
  if (!parsed || typeof parsed !== "object") {
    return {
      verdict: "okay",
      overall: 60,
      reasons: ["Model did not return structured JSON; using fallback."],
      riskFlags: ["model_parse_failed"]
    };
  }

  // Normalize / clamp
  const clamp = (n: any, lo = 0, hi = 100) =>
    Math.max(lo, Math.min(hi, Number.isFinite(+n) ? +n : 0));

  return {
    verdict: (["strong","okay","weak"] as const).includes(parsed.verdict) ? parsed.verdict : "okay",
    overall: clamp(parsed.overall, 0, 100),
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 12) : [],
    riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags.slice(0, 12) : [],
    author: parsed.author && typeof parsed.author === "object" ? {
      score: clamp(parsed.author.score, 0, 100),
      evidence: Array.isArray(parsed.author.evidence) ? parsed.author.evidence.slice(0, 10) : []
    } : undefined,
    dates: parsed.dates && typeof parsed.dates === "object" ? {
      score: clamp(parsed.dates.score, 0, 100),
      evidence: Array.isArray(parsed.dates.evidence) ? parsed.dates.evidence.slice(0, 10) : []
    } : undefined,
    organization: parsed.organization && typeof parsed.organization === "object" ? {
      score: clamp(parsed.organization.score, 0, 100),
      evidence: Array.isArray(parsed.organization.evidence) ? parsed.organization.evidence.slice(0, 10) : []
    } : undefined,
    policies: parsed.policies && typeof parsed.policies === "object" ? {
      score: clamp(parsed.policies.score, 0, 100),
      evidence: Array.isArray(parsed.policies.evidence) ? parsed.policies.evidence.slice(0, 10) : []
    } : undefined
  };
}
