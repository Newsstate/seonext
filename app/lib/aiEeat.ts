// app/lib/aiEeat.ts
import { z } from "zod";

// Strict schema for the model’s JSON reply
export const AiEeatSchema = z.object({
  overall: z.number().min(0).max(100),
  verdict: z.enum(["strong", "okay", "weak"]),
  reasons: z.array(z.string()).default([]),

  author: z.object({
    present: z.boolean(),
    name: z.string().optional(),
    profileUrl: z.string().optional(),
    expertise: z.string().optional(),
    evidence: z.array(z.string()).optional()
  }).optional(),

  dates: z.object({
    published: z.string().nullable().optional(),
    updated: z.string().nullable().optional(),
    evidence: z.array(z.string()).optional()
  }).optional(),

  organization: z.object({
    present: z.boolean().optional(),
    name: z.string().optional(),
    website: z.string().optional(),
    schema: z.boolean().optional(),
    evidence: z.array(z.string()).optional()
  }).optional(),

  policies: z.object({
    editorial: z.boolean().optional(),
    corrections: z.boolean().optional(),
    factcheck: z.boolean().optional(),
    reviewByline: z.boolean().optional(),
    evidence: z.array(z.string()).optional()
  }).optional(),

  riskFlags: z.array(z.string()).default([]),

  // Echo the Who/How/Why provenance roll-up
  who: z.string().nullable().optional(),
  how: z.string().nullable().optional(),
  why: z.string().nullable().optional()
});

export type AiEeatAssessment = z.infer<typeof AiEeatSchema>;

type RunInput = {
  url: string;
  htmlExcerpt: string;   // trimmed, safe excerpt (e.g. first ~8–12k chars)
  facts: any;            // *your* parsed facts: author/publisher/schema/dates, policies, etc.
  callModel: (prompt: { system: string; user: string }) => Promise<string>;
};

/**
 * Runs an AI verdict over your facts. The LLM MUST return strict JSON
 * matching AiEeatSchema. We keep model/provider abstract via `callModel`.
 */
export async function runAIEEAT({ url, htmlExcerpt, facts, callModel }: RunInput): Promise<AiEeatAssessment> {
  const system = [
    "You are an adjudicator of E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).",
    "ONLY use the evidence provided (facts fields and htmlExcerpt). Do not invent external facts.",
    "Return STRICT JSON matching the schema the user expects. No markdown, no extra commentary.",
    "Judging rules (short):",
    "- Strong author signal = named author/profile or organization with clear ownership + dates.",
    "- Policies (editorial/corrections/fact-check) and About/Contact increase trust.",
    "- Proper JSON-LD (Article/Organization/Person) increases clarity.",
    "- Penalize if dates/author missing for YMYL-like content or aggressive ad/review byline is misleading.",
  ].join("\n");

  const userPayload = {
    url,
    htmlExcerpt,
    facts   // this should include eat signals, schema flags, policyHints, etc. from your deterministic step
  };

  const raw = await callModel({
    system,
    user: JSON.stringify(userPayload)
  });

  // Best-effort parse + validate
  let json: unknown;
  try { json = JSON.parse(raw); } catch {
    // small repair: try to find JSON object in the text
    const m = raw.match(/\{[\s\S]*\}$/);
    json = m ? JSON.parse(m[0]) : {};
  }
  return AiEeatSchema.parse(json);
}
