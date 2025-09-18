// app/components/ContentAnalysisTab.tsx
"use client";

import React from "react";
import type { SEOResult } from "@/lib/seo";

type Tone = "ok" | "warn" | "bad" | "default";

/* ---------- UI helpers ---------- */

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  const map = {
    ok: "bg-green-100 text-green-800",
    warn: "bg-amber-100 text-amber-800",
    bad: "bg-red-100 text-red-800",
    default: "bg-gray-100 text-gray-800",
  } as const;
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${map[tone]}`}>{children}</span>
  );
}

function Chip({
  children,
  color = "gray",
}: {
  children: React.ReactNode;
  color?: "green" | "amber" | "blue" | "gray";
}) {
  const map = {
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
    gray: "bg-gray-100 text-gray-800",
  } as const;
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${map[color]}`}>{children}</span>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-6 text-sm break-all space-y-1">
      {items.map((i, idx) => (
        <li key={idx}>{i}</li>
      ))}
    </ul>
  );
}

function hostLabel(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

/* ---------- Main component ---------- */

export default function ContentAnalysisTab({ data }: { data: SEOResult }) {
  const ca = (data as any).contentAnalysis as
    | {
        language: "hi" | "en" | "other";
        contentLength: number;
        readability: { words: number; sentences: number; readMinutes: number; flesch: number };
        indexing: { level: "good" | "medium" | "low"; reasons: string[] };
        plagiarism: {
          enabled: boolean;
          method: "serpapi" | "heuristic" | "disabled";
          score: number | null;
          sources: Array<{ url: string; title?: string; overlap?: number }>;
        };
        seoOptimization: {
          score: number;
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
        spam: {
          score: number;
          keywordStuffing: boolean;
          doorwayPattern: boolean;
          hiddenText: boolean;
          linkSpam: boolean;
          notes: string[];
        };
        eat?: {
          hasAuthorByline: boolean;
          hasPublishedDate: boolean;
          hasUpdatedDate: boolean;
          hasContactOrAbout: boolean;
          schemaHints?: {
            hasArticle: boolean;
            hasOrganization: boolean;
            hasPerson: boolean;
            hasWebSite?: boolean;
            hasProfilePage?: boolean;
            hasBreadcrumb?: boolean;
          };
          author?: { name?: string; url?: string; sameAs?: string[] };
          publisher?: { name?: string; url?: string; logo?: string; sameAs?: string[] };
          publishedISO?: string | null;
          modifiedISO?: string | null;
          policyHints?: {
            hasEditorialPolicy: boolean;
            hasCorrectionsPolicy: boolean;
            hasFactCheckingPolicy: boolean;
            hasReviewByline: boolean;
            foundUrls: string[];
          };
          who?: string | null;
          how?: string | null;
          why?: string | null;
        };
        aiAssessment?: {
          verdict: "strong" | "okay" | "weak";
          overall: number; // 0..100
          reasons: string[];
          author?: { score?: number; evidence?: string[] };
          dates?: { score?: number; evidence?: string[] };
          organization?: { score?: number; evidence?: string[] };
          policies?: { score?: number; evidence?: string[] };
          riskFlags?: string[];
        };
      }
    | undefined;

  if (!ca) {
    return <div className="text-sm text-gray-600">No content analysis available.</div>;
  }

  const idxTone: Tone =
    ca.indexing.level === "good" ? "ok" : ca.indexing.level === "medium" ? "warn" : "bad";
  const spamTone: Tone = ca.spam.score >= 60 ? "bad" : ca.spam.score >= 30 ? "warn" : "ok";
  const plagTone: Tone =
    ca.plagiarism.score == null
      ? "default"
      : ca.plagiarism.score >= 85
      ? "ok"
      : ca.plagiarism.score >= 60
      ? "warn"
      : "bad";

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">
          <div className="text-xs text-gray-500">Language</div>
          <div className="text-lg font-semibold uppercase">{ca.language}</div>
          <div className="text-xs text-gray-500">
            Words: {ca.readability.words} • Flesch: {ca.readability.flesch}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">
          <div className="text-xs text-gray-500">Indexing sufficiency</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold capitalize">{ca.indexing.level}</span>
            <Badge tone={idxTone}>{ca.indexing.level}</Badge>
          </div>
          <div className="text-xs text-gray-500">
            {(ca.indexing.reasons && ca.indexing.reasons[0]) || "—"}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">
          <div className="text-xs text-gray-500">SEO Optimization</div>
          <div className="text-lg font-semibold">{ca.seoOptimization.score}/100</div>
          <div className="text-xs text-gray-500">
            Top terms: {ca.seoOptimization.topTerms.slice(0, 3).join(", ") || "—"}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">
          <div className="text-xs text-gray-500">Plagiarism (unique)</div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">{ca.plagiarism.score ?? "—"}</div>
            <Badge tone={plagTone}>{ca.plagiarism.method}</Badge>
          </div>
          <div className="text-xs text-gray-500">
            {ca.plagiarism.enabled ? "External search" : "Heuristic/disabled"}
          </div>
        </div>
      </div>

      {/* E-E-A-T */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h4 className="font-semibold border-b pb-2">E-E-A-T Hints</h4>

        {/* Quick badges */}
        <div className="mt-3 flex flex-wrap gap-2">
          {ca.eat?.hasAuthorByline ? (
            <Chip color="green">Author byline</Chip>
          ) : (
            <Chip color="amber">No author byline</Chip>
          )}
          {ca.eat?.hasPublishedDate ? (
            <Chip color="green">Published date</Chip>
          ) : (
            <Chip color="amber">No published date</Chip>
          )}
          {ca.eat?.hasUpdatedDate ? (
            <Chip color="green">Updated date</Chip>
          ) : (
            <Chip color="gray">No updated date</Chip>
          )}
          {ca.eat?.hasContactOrAbout ? (
            <Chip color="green">Contact/About present</Chip>
          ) : (
            <Chip color="amber">Add Contact/About</Chip>
          )}
          {ca.eat?.schemaHints?.hasArticle ? (
            <Chip color="blue">Article schema</Chip>
          ) : (
            <Chip color="gray">No Article schema</Chip>
          )}
          {ca.eat?.schemaHints?.hasOrganization ? (
            <Chip color="blue">Organization schema</Chip>
          ) : (
            <Chip color="gray">No Organization schema</Chip>
          )}
          {ca.eat?.schemaHints?.hasPerson ? (
            <Chip color="blue">Person schema</Chip>
          ) : (
            <Chip color="gray">No Person schema</Chip>
          )}
          {ca.eat?.schemaHints?.hasBreadcrumb ? (
            <Chip color="blue">BreadcrumbList</Chip>
          ) : (
            <Chip color="gray">No Breadcrumb</Chip>
          )}
          {ca.eat?.schemaHints?.hasWebSite ? <Chip color="blue">WebSite</Chip> : null}
          {ca.eat?.schemaHints?.hasProfilePage ? <Chip color="blue">ProfilePage</Chip> : null}
        </div>

        {/* Author / Publisher details */}
        <div className="grid md:grid-cols-2 gap-6 mt-4 text-sm text-gray-800">
          <div className="space-y-1">
            <div className="font-medium">Author</div>
            <div>
              {ca.eat?.author?.name || ca.eat?.author?.url ? (
                <>
                  {ca.eat?.author?.name && <b>{ca.eat.author.name}</b>}
                  {ca.eat?.author?.url && (
                    <>
                      {" "}
                      -{" "}
                      <a
                        className="underline"
                        href={ca.eat.author.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Profile
                      </a>
                    </>
                  )}
                  {Array.isArray(ca.eat?.author?.sameAs) &&
                    (ca.eat.author.sameAs?.length || 0) > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(ca.eat.author.sameAs || []).slice(0, 8).map((u: string, i: number) => (
                          <a
                            key={i}
                            className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                            href={u}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {hostLabel(u)}
                          </a>
                        ))}
                      </div>
                    )}
                </>
              ) : (
                <i>—</i>
              )}
            </div>

            <div className="font-medium mt-3">Dates</div>
            <div>
              Published: <b>{ca.eat?.publishedISO || "—"}</b>
              <br />
              Updated: <b>{ca.eat?.modifiedISO || "—"}</b>
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-medium">Publisher / Organization</div>
            <div>
              {ca.eat?.publisher?.name ? <b>{ca.eat.publisher.name}</b> : <i>—</i>}
              {ca.eat?.publisher?.url && (
                <>
                  {" "}
                  —{" "}
                  <a
                    className="underline"
                    href={ca.eat.publisher.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ca.eat.publisher.url}
                  </a>
                </>
              )}
              {ca.eat?.publisher?.logo && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ca.eat.publisher.logo} alt="logo" className="h-6" />
                </div>
              )}
              {Array.isArray(ca.eat?.publisher?.sameAs) &&
                (ca.eat.publisher.sameAs?.length || 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(ca.eat.publisher.sameAs || []).slice(0, 8).map((u: string, i: number) => (
                      <a
                        key={i}
                        className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {hostLabel(u)}
                      </a>
                    ))}
                  </div>
                )}
            </div>

            <div className="font-medium mt-3">Policies & Reputation</div>
            <div className="flex flex-wrap gap-2">
              {ca.eat?.policyHints?.hasEditorialPolicy ? (
                <Chip color="blue">Editorial policy</Chip>
              ) : (
                <Chip color="gray">No editorial policy</Chip>
              )}
              {ca.eat?.policyHints?.hasCorrectionsPolicy ? (
                <Chip color="blue">Corrections policy</Chip>
              ) : (
                <Chip color="gray">No corrections policy</Chip>
              )}
              {ca.eat?.policyHints?.hasFactCheckingPolicy ? (
                <Chip color="blue">Fact-check policy</Chip>
              ) : (
                <Chip color="gray">No fact-check policy</Chip>
              )}
              {ca.eat?.policyHints?.hasReviewByline ? <Chip color="green">Reviewed by</Chip> : null}
            </div>

            {Array.isArray(ca.eat?.policyHints?.foundUrls) &&
              (ca.eat.policyHints?.foundUrls?.length || 0) > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  {(ca.eat.policyHints?.foundUrls || [])
                    .slice(0, 8)
                    .map((u: string, i: number) => (
                      <a key={i} className="mr-2 underline" href={u} target="_blank" rel="noreferrer">
                        {u}
                      </a>
                    ))}
                </div>
              )}
          </div>
        </div>

        {/* Who / How / Why */}
        <div className="mt-4 text-xs text-gray-600">
          <div>
            Who: <b>{ca.eat?.who || "—"}</b>
          </div>
          <div>
            How: <b>{ca.eat?.how || "—"}</b>
          </div>
          <div>
            Why: <b>{ca.eat?.why || "—"}</b>
          </div>
        </div>
      </section>

      {/* Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow-sm p-5 space-y-2">
          <h3 className="text-base font-semibold">SEO optimization checks</h3>
          <div className="text-sm grid gap-1">
            <div>
              Title has top term:{" "}
              <Badge tone={ca.seoOptimization.checks.titleIncludesTopTerm ? "ok" : "warn"}>
                {String(ca.seoOptimization.checks.titleIncludesTopTerm)}
              </Badge>
            </div>
            <div>
              H1 has top term:{" "}
              <Badge tone={ca.seoOptimization.checks.h1IncludesTopTerm ? "ok" : "warn"}>
                {String(ca.seoOptimization.checks.h1IncludesTopTerm)}
              </Badge>
            </div>
            <div>
              Meta description present:{" "}
              <Badge tone={ca.seoOptimization.checks.metaDescriptionPresent ? "ok" : "warn"}>
                {String(ca.seoOptimization.checks.metaDescriptionPresent)}
              </Badge>
            </div>
            <div>
              Image alt coverage:{" "}
              <Badge
                tone={
                  ca.seoOptimization.checks.imageAltCoverage >= 0.7
                    ? "ok"
                    : "warn"
                }
              >
                {Math.round(ca.seoOptimization.checks.imageAltCoverage * 100)}%
              </Badge>
            </div>
            <div>
              Internal links: <Badge>{ca.seoOptimization.checks.internalLinkCount}</Badge>
            </div>
            <div>
              Top-term density:{" "}
              <Badge
                tone={
                  ca.seoOptimization.checks.keywordDensityTop > 0.07 ? "warn" : "ok"
                }
              >
                {Math.round(ca.seoOptimization.checks.keywordDensityTop * 1000) / 10}%
              </Badge>
            </div>
          </div>

          {!!(ca.seoOptimization.notes?.length || 0) && (
            <div className="pt-2 text-xs text-amber-700">
              {ca.seoOptimization.notes.map((n: string, i: number) => (
                <div key={i}>• {n}</div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-sm p-5 space-y-2">
          <h3 className="text-base font-semibold">Spam signals</h3>
          <div className="flex items-center gap-2">
            <div className="text-sm">Score:</div>
            <div className="text-lg font-semibold">{ca.spam.score}/100</div>
            <Badge tone={spamTone}>{spamTone}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              Keyword stuffing:{" "}
              <Badge tone={ca.spam.keywordStuffing ? "bad" : "ok"}>
                {String(ca.spam.keywordStuffing)}
              </Badge>
            </div>
            <div>
              Doorway pattern:{" "}
              <Badge tone={ca.spam.doorwayPattern ? "warn" : "ok"}>
                {String(ca.spam.doorwayPattern)}
              </Badge>
            </div>
            <div>
              Hidden text:{" "}
              <Badge tone={ca.spam.hiddenText ? "bad" : "ok"}>
                {String(ca.spam.hiddenText)}
              </Badge>
            </div>
            <div>
              Link spam:{" "}
              <Badge tone={ca.spam.linkSpam ? "warn" : "ok"}>
                {String(ca.spam.linkSpam)}
              </Badge>
            </div>
          </div>

          {!!(ca.spam.notes?.length || 0) && (
            <div className="pt-2 text-xs text-amber-700">
              {ca.spam.notes.map((n: string, i: number) => (
                <div key={i}>• {n}</div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-sm p-5 space-y-2 md:col-span-2">
          <h3 className="text-base font-semibold">Potentially matching sources (plagiarism)</h3>
          {ca.plagiarism.sources?.length ? (
            <ul className="list-disc pl-6 text-sm break-all">
              {ca.plagiarism.sources.slice(0, 10).map((s, i) => (
                <li key={(s.url || "src") + i}>
                  <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                    {s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600">
              No external matches found (or external search disabled).
            </div>
          )}
        </section>

        {/* AI E-E-A-T Verdict */}
        <section className="bg-white rounded-xl shadow-sm p-5 md:col-span-2">
          <h4 className="font-semibold border-b pb-2">AI E-E-A-T Verdict</h4>
          {ca.aiAssessment ? (
            <>
              <div className="flex items-center justify-between mt-2">
                <div className="text-sm">
                  Verdict:{" "}
                  <b
                    className={
                      ca.aiAssessment.verdict === "strong"
                        ? "text-green-700"
                        : ca.aiAssessment.verdict === "okay"
                        ? "text-amber-700"
                        : "text-red-700"
                    }
                  >
                    {ca.aiAssessment.verdict.toUpperCase()}
                  </b>
                </div>
                <div className="text-sm">
                  Score: <b>{ca.aiAssessment.overall}/100</b>
                </div>
              </div>

              {!!(ca.aiAssessment.reasons?.length || 0) && (
                <ul className="list-disc pl-5 mt-3 text-sm text-gray-800">
                  {ca.aiAssessment.reasons.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}

              {/* Evidence expanders */}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Evidence</summary>
                <div className="mt-2 text-xs text-gray-700 space-y-2">
                  {ca.aiAssessment.author?.evidence && (
                    <div>
                      <b>Author:</b> {ca.aiAssessment.author.evidence.join(" · ")}
                    </div>
                  )}
                  {ca.aiAssessment.dates?.evidence && (
                    <div>
                      <b>Dates:</b> {ca.aiAssessment.dates.evidence.join(" · ")}
                    </div>
                  )}
                  {ca.aiAssessment.organization?.evidence && (
                    <div>
                      <b>Organization:</b>{" "}
                      {ca.aiAssessment.organization.evidence.join(" · ")}
                    </div>
                  )}
                  {ca.aiAssessment.policies?.evidence && (
                    <div>
                      <b>Policies:</b> {ca.aiAssessment.policies.evidence.join(" · ")}
                    </div>
                  )}
                  {!!(ca.aiAssessment.riskFlags?.length || 0) && (
                    <div>
                      <b>Risks:</b> {ca.aiAssessment.riskFlags!.join(", ")}
                    </div>
                  )}
                </div>
              </details>
            </>
          ) : (
            <p className="text-sm text-gray-600 mt-2">
              AI E-E-A-T is disabled or not available for this scan.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
