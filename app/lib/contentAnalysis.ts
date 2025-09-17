// app/components/ContentAnalysisTab.tsx
"use client";

import React from "react";

export default function ContentAnalysisTab({ data }: { data: any }) {
  const ca = data?.contentAnalysis;
  if (!ca) {
    return (
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-lg font-semibold border-b pb-2">Content Analysis</h3>
        <p className="text-sm text-gray-600 pt-3">
          No analysis found. Run a scan to see content insights.
        </p>
      </section>
    );
  }

  // Support both shapes:
  const optScore: number =
    (ca.optimization?.score as number) ??
    (ca.seoOptimization?.score as number) ??
    0;

  const optNotes: string[] =
    (ca.optimization?.rationale as string[]) ??
    (ca.seoOptimization?.notes as string[]) ??
    [];

  const s = ca.signals || {};
  const spam = ca.spam || {};
  const eat = ca.eat || {};
  const lengthGuidance = ca.lengthGuidance || { meetsMinimum: false, recommendedMin: 0 };

  const badge = (
    txt: string,
    tone: "gray" | "green" | "red" | "amber" | "blue" = "gray"
  ) => {
    const map: Record<typeof tone, string> = {
      gray: "bg-gray-100 text-gray-700",
      green: "bg-green-100 text-green-700",
      red: "bg-red-100 text-red-700",
      amber: "bg-amber-100 text-amber-700",
      blue: "bg-blue-100 text-blue-700",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs ${map[tone]} mr-2`}>
        {txt}
      </span>
    );
  };

  const bar = (value: number, max = 100) => {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-2 bg-blue-500" style={{ width: `${pct}%` }} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Score */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Optimization Score</h3>
          {badge(
            `${optScore}/100`,
            optScore >= 80 ? "green" : optScore >= 60 ? "amber" : "red"
          )}
        </div>
        <div className="mt-3">{bar(optScore)}</div>

        {optNotes.length > 0 && (
          <div className="pt-2 text-xs text-amber-700">
            {optNotes.map((n: string, i: number) => (
              <div key={i}>• {n}</div>
            ))}
          </div>
        )}
      </section>

      {/* Basics */}
      <section className="bg-white rounded-xl shadow-sm p-5 grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h4 className="font-semibold">Language & Length</h4>
          <div className="text-sm text-gray-700">
            {badge(`Language: ${(s.language || "—").toString().toUpperCase()}`, "blue")}
            {badge(`Confidence: ${s.langConfidence ?? "—"}`, "gray")}
          </div>
          <div className="text-sm text-gray-700">
            Words: <b>{s.wordCount ?? 0}</b> · Sentences: <b>{s.sentences ?? 0}</b> · Reading time:{" "}
            <b>{s.readMinutes ?? 0} min</b>
          </div>
          <div className="text-sm text-gray-700">
            Flesch: <b>{s.flesch ?? "—"}</b>{" "}
            {typeof s.flesch === "number"
              ? s.flesch < 45
                ? badge("Hard", "amber")
                : badge("OK", "green")
              : null}
          </div>
          <div className="text-sm text-gray-700">
            {lengthGuidance.meetsMinimum
              ? badge("Meets minimum length", "green")
              : badge(`Below recommended min (${lengthGuidance.recommendedMin})`, "amber")}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Structure & Media</h4>
          <div className="text-sm text-gray-700">
            H1: <b>{s.headings?.h1 ? "Present" : "Missing"}</b> · H2:{" "}
            <b>{s.headings?.h2Count ?? 0}</b> · H3: <b>{s.headings?.h3Count ?? 0}</b>
          </div>
          <div className="text-sm text-gray-700">
            Internal links: <b>{s.internalLinkCount ?? 0}</b>
          </div>
          <div className="text-sm text-gray-700">
            Images: <b>{s.imageCount ?? 0}</b> · Missing alt: <b>{s.imagesMissingAlt ?? 0}</b>
          </div>
          <div className="text-sm text-gray-700">
            Primary topic: <b>{s.primaryKeyword || "—"}</b>
          </div>
        </div>
      </section>

      {/* Keywords */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h4 className="font-semibold border-b pb-2">Top Keywords (by frequency)</h4>
        <div className="mt-3 grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs uppercase text-gray-500 mb-2">Singles</div>
            <ul className="text-sm text-gray-800 space-y-1">
              {(s.keywordDensityTop || []).map(
                (k: { term: string; count: number; densityPct: number }, i: number) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="truncate">{k.term}</span>
                    <span className="text-gray-500">
                      {k.count} · {k.densityPct}%
                    </span>
                  </li>
                )
              )}
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-500 mb-2">Candidates</div>
            <div className="flex flex-wrap gap-2">
              {(s.keywordCandidates || []).slice(0, 20).map((t: string, i: number) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Spam signals */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h4 className="font-semibold border-b pb-2">Spam Signals</h4>
        <ul className="mt-3 text-sm text-gray-800 space-y-2">
          <li>
            {spam.keywordStuffing
              ? badge("Keyword stuffing suspected", "red")
              : badge("No stuffing detected", "green")}
            {Array.isArray(spam.stuffingTerms) && spam.stuffingTerms.length ? (
              <span className="ml-2 text-gray-600">
                (
                {spam.stuffingTerms
                  .map(
                    (t: { term: string; densityPct: number }) =>
                      `${t.term} ${t.densityPct}%`
                  )
                  .join(", ")}
                )
              </span>
            ) : null}
          </li>
          <li>
            {spam.hiddenText?.found
              ? badge("Hidden text found", "red")
              : badge("No hidden text styles", "green")}
          </li>
          <li>
            {spam.exactMatchAnchorOveruse
              ? badge("Exact-match anchors overused", "amber")
              : badge("Anchor diversity OK", "green")}
          </li>
          <li>
            {spam.doorwayPattern
              ? badge("Doorway-like link pattern", "amber")
              : badge("No doorway pattern", "green")}
          </li>
          <li>
            {spam.aggressiveAffiliateFootprint
              ? badge("Aggressive affiliate/ads footprint", "amber")
              : badge("Ads footprint OK", "green")}
          </li>
        </ul>
      </section>

      {/* E-E-A-T */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h4 className="font-semibold border-b pb-2">E-E-A-T Hints</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {eat.hasAuthorByline ? badge("Author byline", "green") : badge("No author byline", "amber")}
          {eat.hasPublishedDate ? badge("Published date", "green") : badge("No published date", "amber")}
          {eat.hasUpdatedDate ? badge("Updated date", "green") : badge("No updated date", "gray")}
          {eat.hasContactOrAbout ? badge("Contact/About present", "green") : badge("Add Contact/About", "amber")}
          {eat.schemaHints?.hasArticle ? badge("Article schema", "blue") : badge("No Article schema", "gray")}
          {eat.schemaHints?.hasOrganization ? badge("Organization schema", "blue") : badge("No Organization schema", "gray")}
        </div>
      </section>

      {/* Plagiarism */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h4 className="font-semibold border-b pb-2">Plagiarism (basic)</h4>
        <div className="text-sm text-gray-700 pt-2">
          Mode: <b>{ca.plagiarism?.mode || "—"}</b>
          {ca.plagiarism?.score != null ? (
            <>
              {" "}
              · Score: <b>{ca.plagiarism.score}</b>
            </>
          ) : null}
          {Array.isArray(ca.plagiarism?.notes) && ca.plagiarism.notes.length ? (
            <ul className="list-disc pl-5 mt-2 text-gray-700">
              {ca.plagiarism.notes.map((n: string, i: number) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* Suggestions */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h4 className="font-semibold border-b pb-2">Actionable Suggestions</h4>
        <ul className="mt-3 text-sm text-gray-800 space-y-2">
          {(ca.suggestions || []).map(
            (
              s: { severity: "high" | "medium" | "low"; text: string },
              i: number
            ) => (
              <li key={i}>
                {s.severity === "high"
                  ? badge("High", "red")
                  : s.severity === "medium"
                  ? badge("Medium", "amber")
                  : badge("Low", "gray")}
                <span className="ml-2">{s.text}</span>
              </li>
            )
          )}
          {(!ca.suggestions || ca.suggestions.length === 0) && (
            <li className="text-gray-600">Looks good — no suggestions right now.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
