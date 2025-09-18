// app/components/ContentAnalysisTab.tsx

"use client";

import React from "react";

import type { SEOResult } from "@/lib/seo";



function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "ok"|"warn"|"bad"|"default" }) {

  const map = {

    ok: "bg-green-100 text-green-800",

    warn: "bg-amber-100 text-amber-800",

    bad: "bg-red-100 text-red-800",

    default: "bg-gray-100 text-gray-800"

  } as const;

  return <span className={`px-2 py-0.5 rounded text-xs ${map[tone]}`}>{children}</span>;

}



function List({ items }: { items: string[] }) {

  return (

    <ul className="list-disc pl-6 text-sm break-all space-y-1">

      {items.map((i, idx) => <li key={idx}>{i}</li>)}

    </ul>

  );

}



export default function ContentAnalysisTab({ data }: { data: SEOResult }) {

  const ca = data.contentAnalysis;

  if (!ca) return <div className="text-sm text-gray-600">No content analysis available.</div>;



  const idxTone = ca.indexing.level === "good" ? "ok" : ca.indexing.level === "medium" ? "warn" : "bad";

  const spamTone = ca.spam.score >= 60 ? "bad" : ca.spam.score >= 30 ? "warn" : "ok";

  const plagTone = ca.plagiarism.score == null ? "default"

                  : ca.plagiarism.score >= 85 ? "ok"

                  : ca.plagiarism.score >= 60 ? "warn" : "bad";



  return (

    <div className="space-y-6">

      {/* Summary cards */}

      <div className="grid md:grid-cols-4 gap-4">

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">

          <div className="text-xs text-gray-500">Language</div>

          <div className="text-lg font-semibold uppercase">{ca.language}</div>

          <div className="text-xs text-gray-500">Words: {ca.readability.words} • Flesch: {ca.readability.flesch}</div>

        </div>



        <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">

          <div className="text-xs text-gray-500">Indexing sufficiency</div>

          <div className="flex items-center gap-2">

            <span className="text-lg font-semibold capitalize">{ca.indexing.level}</span>

            <Badge tone={idxTone as any}>{ca.indexing.level}</Badge>

          </div>

          <div className="text-xs text-gray-500">{ca.indexing.reasons[0]}</div>

        </div>



        <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">

          <div className="text-xs text-gray-500">SEO Optimization</div>

          <div className="text-lg font-semibold">{ca.seoOptimization.score}/100</div>

          <div className="text-xs text-gray-500">Top terms: {ca.seoOptimization.topTerms.slice(0,3).join(", ") || "—"}</div>

        </div>



        <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">

          <div className="text-xs text-gray-500">Plagiarism (unique)</div>

          <div className="flex items-center gap-2">

            <div className="text-lg font-semibold">{ca.plagiarism.score ?? "—"}</div>

            <Badge tone={plagTone as any}>{ca.plagiarism.method}</Badge>

          </div>

          <div className="text-xs text-gray-500">{ca.plagiarism.enabled ? "External search" : "Heuristic/disabled"}</div>

        </div>

      </div>



      {/* E-E-A-T */}

<section className="bg-white rounded-xl shadow-sm p-5">

  <h4 className="font-semibold border-b pb-2">E-E-A-T Hints</h4>



  {/* Quick badges */}

  <div className="mt-3 flex flex-wrap gap-2">

    {ca.eat?.hasAuthorByline ? badge("Author byline", "green") : badge("No author byline", "amber")}

    {ca.eat?.hasPublishedDate ? badge("Published date", "green") : badge("No published date", "amber")}

    {ca.eat?.hasUpdatedDate ? badge("Updated date", "green") : badge("No updated date", "gray")}

    {ca.eat?.hasContactOrAbout ? badge("Contact/About present", "green") : badge("Add Contact/About", "amber")}

    {ca.eat?.schemaHints?.hasArticle ? badge("Article schema", "blue") : badge("No Article schema", "gray")}

    {ca.eat?.schemaHints?.hasOrganization ? badge("Organization schema", "blue") : badge("No Organization schema", "gray")}

    {ca.eat?.schemaHints?.hasPerson ? badge("Person schema", "blue") : badge("No Person schema", "gray")}

    {ca.eat?.schemaHints?.hasBreadcrumb ? badge("BreadcrumbList", "blue") : badge("No Breadcrumb", "gray")}

    {ca.eat?.schemaHints?.hasWebSite ? badge("WebSite", "blue") : null}

    {ca.eat?.schemaHints?.hasProfilePage ? badge("ProfilePage", "blue") : null}

  </div>



  {/* Author / Publisher details */}

  <div className="grid md:grid-cols-2 gap-6 mt-4 text-sm text-gray-800">

    <div className="space-y-1">

      <div className="font-medium">Author</div>

      <div>

        {(ca.eat?.author?.name || ca.eat?.author?.url) ? (

          <>

            {ca.eat?.author?.name && <b>{ca.eat.author.name}</b>}

            {ca.eat?.author?.url && (

              <>

                {" "}- <a className="underline" href={ca.eat.author.url} target="_blank" rel="noreferrer">Profile</a>

              </>

            )}

            {Array.isArray(ca.eat?.author?.sameAs) && ca.eat.author.sameAs.length > 0 && (

              <div className="mt-1 flex flex-wrap gap-2">

                {ca.eat.author.sameAs.slice(0,8).map((u: string, i: number)=>(

                  <a key={i} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700" href={u} target="_blank" rel="noreferrer">{new URL(u).hostname}</a>

                ))}

              </div>

            )}

          </>

        ) : <i>—</i>}

      </div>



      <div className="font-medium mt-3">Dates</div>

      <div>

        Published: <b>{ca.eat?.publishedISO || "—"}</b><br/>

        Updated: <b>{ca.eat?.modifiedISO || "—"}</b>

      </div>

    </div>



    <div className="space-y-1">

      <div className="font-medium">Publisher / Organization</div>

      <div>

        {ca.eat?.publisher?.name ? <b>{ca.eat.publisher.name}</b> : <i>—</i>}

        {ca.eat?.publisher?.url && (

          <> — <a className="underline" href={ca.eat.publisher.url} target="_blank" rel="noreferrer">{ca.eat.publisher.url}</a></>

        )}

        {ca.eat?.publisher?.logo && (

          <div className="mt-2">

            <img src={ca.eat.publisher.logo} alt="logo" className="h-6" />

          </div>

        )}

        {Array.isArray(ca.eat?.publisher?.sameAs) && ca.eat.publisher.sameAs.length > 0 && (

          <div className="mt-2 flex flex-wrap gap-2">

            {ca.eat.publisher.sameAs.slice(0,8).map((u: string, i: number)=>(

              <a key={i} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700" href={u} target="_blank" rel="noreferrer">{new URL(u).hostname}</a>

            ))}

          </div>

        )}

      </div>



      <div className="font-medium mt-3">Policies & Reputation</div>

      <div className="flex flex-wrap gap-2">

        {ca.eat?.policyHints?.hasEditorialPolicy ? badge("Editorial policy", "blue") : badge("No editorial policy", "gray")}

        {ca.eat?.policyHints?.hasCorrectionsPolicy ? badge("Corrections policy", "blue") : badge("No corrections policy", "gray")}

        {ca.eat?.policyHints?.hasFactCheckingPolicy ? badge("Fact-check policy", "blue") : badge("No fact-check policy", "gray")}

        {ca.eat?.policyHints?.hasReviewByline ? badge("Reviewed by", "green") : null}

      </div>

      {Array.isArray(ca.eat?.policyHints?.foundUrls) && ca.eat.policyHints.foundUrls.length > 0 && (

        <div className="mt-2 text-xs text-gray-600">

          {ca.eat.policyHints.foundUrls.slice(0,8).map((u: string, i: number)=>(

            <a key={i} className="mr-2 underline" href={u} target="_blank" rel="noreferrer">{u}</a>

          ))}

        </div>

      )}

    </div>

  </div>



  {/* Who / How / Why */}

  <div className="mt-4 text-xs text-gray-600">

    <div>Who: <b>{ca.eat?.who || "—"}</b></div>

    <div>How: <b>{ca.eat?.how || "—"}</b></div>

    <div>Why: <b>{ca.eat?.why || "—"}</b></div>

  </div>

</section>



      {/* Details */}

      <div className="grid md:grid-cols-2 gap-6">

        <section className="bg-white rounded-xl shadow-sm p-5 space-y-2">

          <h3 className="text-base font-semibold">SEO optimization checks</h3>

          <div className="text-sm grid gap-1">

            <div>Title has top term: <Badge tone={ca.seoOptimization.checks.titleIncludesTopTerm ? "ok" : "warn"}>{String(ca.seoOptimization.checks.titleIncludesTopTerm)}</Badge></div>

            <div>H1 has top term: <Badge tone={ca.seoOptimization.checks.h1IncludesTopTerm ? "ok" : "warn"}>{String(ca.seoOptimization.checks.h1IncludesTopTerm)}</Badge></div>

            <div>Meta description present: <Badge tone={ca.seoOptimization.checks.metaDescriptionPresent ? "ok" : "warn"}>{String(ca.seoOptimization.checks.metaDescriptionPresent)}</Badge></div>

            <div>Image alt coverage: <Badge tone={ca.seoOptimization.checks.imageAltCoverage >= 0.7 ? "ok" : "warn"}>

              {(Math.round(ca.seoOptimization.checks.imageAltCoverage*100))}%

            </Badge></div>

            <div>Internal links: <Badge>{ca.seoOptimization.checks.internalLinkCount}</Badge></div>

            <div>Top-term density: <Badge tone={ca.seoOptimization.checks.keywordDensityTop > 0.07 ? "warn" : "ok"}>

              {(Math.round(ca.seoOptimization.checks.keywordDensityTop*1000)/10)}%

            </Badge></div>

          </div>

          {!!ca.seoOptimization.notes.length && (

            <div className="pt-2 text-xs text-amber-700">

              {ca.seoOptimization.notes.map((n,i)=><div key={i}>• {n}</div>)}

            </div>

          )}

        </section>



        <section className="bg-white rounded-xl shadow-sm p-5 space-y-2">

          <h3 className="text-base font-semibold">Spam signals</h3>

          <div className="flex items-center gap-2">

            <div className="text-sm">Score:</div>

            <div className="text-lg font-semibold">{ca.spam.score}/100</div>

            <Badge tone={spamTone as any}>{spamTone}</Badge>

          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">

            <div>Keyword stuffing: <Badge tone={ca.spam.keywordStuffing ? "bad" : "ok"}>{String(ca.spam.keywordStuffing)}</Badge></div>

            <div>Doorway pattern: <Badge tone={ca.spam.doorwayPattern ? "warn" : "ok"}>{String(ca.spam.doorwayPattern)}</Badge></div>

            <div>Hidden text: <Badge tone={ca.spam.hiddenText ? "bad" : "ok"}>{String(ca.spam.hiddenText)}</Badge></div>

            <div>Link spam: <Badge tone={ca.spam.linkSpam ? "warn" : "ok"}>{String(ca.spam.linkSpam)}</Badge></div>

          </div>

          {!!ca.spam.notes.length && (

            <div className="pt-2 text-xs text-amber-700">

              {ca.spam.notes.map((n,i)=><div key={i}>• {n}</div>)}

            </div>

          )}

        </section>



        <section className="bg-white rounded-xl shadow-sm p-5 space-y-2 md:col-span-2">

          <h3 className="text-base font-semibold">Potentially matching sources (plagiarism)</h3>

          {ca.plagiarism.sources?.length ? (

            <ul className="list-disc pl-6 text-sm break-all">

              {ca.plagiarism.sources.slice(0,10).map((s, i) => (

                <li key={s.url + i}>

                  <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>

                </li>

              ))}

            </ul>

          ) : (

            <div className="text-sm text-gray-600">No external matches found (or external search disabled).</div>

          )}

        </section>

      </div>

    </div>

  );

}
