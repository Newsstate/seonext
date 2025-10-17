"use client";

import React, { useState } from "react";
import ScorePills from "./ScorePills";
import IndexingCard from "./IndexingCard";
import LinkCheckerCard from "./LinkCheckerCard";
import PsiCard from "./PsiCard";
import SitemapCard from "./SitemapCard";
import RedirectsCard from "./RedirectsCard";
import RobotsCard from "./RobotsCard";
import HreflangCard from "./HreflangCard";
import CanonicalizeCard from "./CanonicalizeCard";
import ImageAuditCard from "./ImageAuditCard";
import HeadersCard from "./HeadersCard";
import AmpCard from "./AmpCard";
import RenderCompareCard from "./RenderCompareCard";
import CrawlHintsCard from "./CrawlHintsCard";
import TouchpointsCard from "./TouchpointsCard";
import OverviewFindings from "./OverviewFindings";
import ContentAnalysisTab from "@/components/ContentAnalysisTab";

type Details = {
  imagesMissingAlt?: string[];
  imagesNoLazy?: string[];
  imagesNoSize?: string[];
  scriptsHeadBlocking?: string[];
  linksAll?: string[];
};

type DiscoverFinding = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  detail: string;
  recommendation?: string;
  evidence?: any;
};

type DiscoverReport = {
  url: string;
  overallScore: number; // 0-100
  chance: "Low" | "Medium" | "High";
  pillars: Record<string, number>;
  findings: DiscoverFinding[];
  aiSuggestions?: {
    improvedTitle?: string[];
    improvedIntro?: string[];
    imageBriefs?: string[];
    schemaPatch?: Record<string, any>;
    checklist?: string[];
  };
  meta?: Record<string, any>;
};

export default function ResultCard({ data }: { data: any }) {
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "contentAnalysis", label: "Content Analysis" }, // NEW
    { key: "social", label: "Social" },                    // OG + Twitter
    { key: "links", label: "Links" },
    { key: "structured", label: "Structured Data" },
    { key: "technical", label: "Technical" },
    { key: "indexing", label: "Indexing" },
    { key: "performance", label: "Performance" },
    { key: "discover", label: "Discover" },               // 👈 NEW TAB
  ] as const;

  type TabKey = typeof tabs[number]["key"];
  const [active, setActive] = useState<TabKey>("overview");

  const pageUrl: string = data.finalUrl || data.url;
  const Links = data.links || {};
  const og = data.og || {};
  const tw = data.twitter || {};

  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discover, setDiscover] = useState<DiscoverReport | null>(null);

  async function runDiscover() {
    setDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const body: any = { url: pageUrl, useAI: true };
      if (data.rawHTML) body.pageHTML = data.rawHTML; // reuse fetched HTML if available

      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Discover check failed");
      setDiscover(j);
    } catch (e: any) {
      setDiscoverError(e.message || "Failed to run Discover");
    } finally {
      setDiscoverLoading(false);
    }
  }

  const getStatusColor = (status: number | undefined) => {
    if (!status) return "bg-gray-100 text-gray-600";
    if (status >= 200 && status < 300) return "bg-green-100 text-green-700";
    if (status >= 300 && status < 400) return "bg-blue-100 text-blue-700";
    if (status >= 400 && status < 500) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  const getRobotsColor = (robotsMeta: any, robots: string) => {
    if (!robotsMeta && !robots) return "bg-gray-100 text-gray-600";
    const isNoIndex = robotsMeta?.index === false || /noindex/i.test(robots || "");
    return isNoIndex ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700";
  };

  return (
    <div className="bg-gray-50 rounded-2xl shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-gray-400">Scanned</div>
          <div className="text-lg font-semibold break-all text-gray-800">
            {pageUrl}
          </div>
          {data.redirected && data.finalUrl !== data.url && (
            <div className="text-xs text-gray-500">Redirected from: {data.url}</div>
          )}
        </div>
        <ScorePills data={data} />
      </div>

      {/* Tabs */}
      <nav className="flex gap-3 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-3 py-2 text-sm ${
              active === t.key
                ? "border-b-2 border-black font-semibold"
                : "text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* SWITCH */}
      {active === "contentAnalysis" ? (
        <ContentAnalysisTab data={data} />
      ) : active === "social" ? (
        <>
          <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Open Graph</h3>
            <pre className="bg-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
              {JSON.stringify(og, null, 2)}
            </pre>
          </section>

          <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Twitter</h3>
            <pre className="bg-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
              {JSON.stringify(tw, null, 2)}
            </pre>
          </section>

          {/* Optional: keep image/schema bits with social if you like */}
          <ImageAuditCard url={pageUrl} />
          <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Schema Types</h3>
            <div>{(data.schemaTypes || []).join(", ") || <i>—</i>}</div>
          </section>
        </>
      ) : active === "links" ? (
        <>
          <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Links</h3>
            <div className="grid grid-cols-[130px_1fr] gap-y-3 gap-x-3 text-sm text-gray-700">
              <div className="font-medium">Total</div>
              <div>{Links.total ?? 0}</div>

              <div className="font-medium">Internal</div>
              <div>{Links.internal ?? 0}</div>

              <div className="font-medium">External</div>
              <div>{Links.external ?? 0}</div>

              <div className="font-medium">Nofollow</div>
              <div>{Links.nofollow ?? 0}</div>
            </div>
          </section>

          <LinkCheckerCard url={pageUrl} />
        </>
      ) : active === "structured" ? (
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-lg font-semibold border-b pb-2">Schema Types</h3>
          <div className="pt-2">
            {(data.schemaTypes || []).join(", ") || <i>—</i>}
          </div>
        </section>
      ) : active === "technical" ? (
        <>
          <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Technical Basics</h3>
            <div className="grid grid-cols-[130px_1fr] gap-y-3 gap-x-3 text-sm text-gray-700">
              <div className="font-medium">Viewport</div>
              <div>{data.viewport || <i>—</i>}</div>

              <div className="font-medium">Lang</div>
              <div>{data.lang || <i>—</i>}</div>

              <div className="font-medium">Robots</div>
              <div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRobotsColor(
                    data.robotsMeta,
                    data.robots
                  )}`}
                >
                  {data.robotsMeta
                    ? `${data.robotsMeta.index ? "index" : "noindex"}, ${
                        data.robotsMeta.follow ? "follow" : "nofollow"
                      }${data.robotsMeta.raw ? ` (${data.robotsMeta.raw})` : ""}`
                    : data.robots || "—"}
                </span>
              </div>
            </div>
          </section>

          <HeadersCard url={pageUrl} />
          <ImageAuditCard url={pageUrl} />
          <AmpCard url={pageUrl} />
          <RenderCompareCard url={pageUrl} />
          <CrawlHintsCard url={pageUrl} />
          <TouchpointsCard url={pageUrl} />
          <CanonicalizeCard url={pageUrl} />
          <RedirectsCard url={pageUrl} />
          <RobotsCard url={pageUrl} />
        </>
      ) : active === "indexing" ? (
        <>
          <IndexingCard url={pageUrl} />
          <SitemapCard url={pageUrl} />
          <HreflangCard url={pageUrl} />
          <CanonicalizeCard url={pageUrl} />
          <RobotsCard url={pageUrl} />
        </>
      ) : active === "performance" ? (
        <PsiCard url={pageUrl} />
      ) : active === "discover" ? (
        <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Discover Readiness</h3>
              <p className="text-sm text-gray-600 break-all">{pageUrl}</p>
            </div>
            <button
              onClick={runDiscover}
              disabled={discoverLoading}
              className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50"
            >
              {discoverLoading ? "Scanning…" : (discover ? "Re-run" : "Run Discover Check")}
            </button>
          </div>

          {discoverError && (
            <div className="text-sm text-red-600">{discoverError}</div>
          )}

          {discover && (
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div className="text-3xl font-bold">{discover.overallScore}</div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {discover.chance}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(discover.pillars).map(([k, v]) => (
                  <div key={k} className="rounded-xl border p-3">
                    <div className="text-xs uppercase text-gray-500">{k}</div>
                    <div className="text-xl font-semibold">{v}</div>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="font-semibold mb-2">Findings</h4>
                {discover.findings?.length ? (
                  <ul className="space-y-2">
                    {discover.findings.map((f) => (
                      <li key={f.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{f.title}</span>
                          <span className="text-xs px-2 py-1 rounded-full border">{f.severity}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{f.detail}</p>
                        {f.recommendation && (
                          <p className="text-sm mt-1">
                            <span className="font-medium">Fix:</span> {f.recommendation}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-600">No issues detected.</div>
                )}
              </div>

              {discover.aiSuggestions && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl border p-4">
                    <h4 className="font-semibold mb-1">AI Title Ideas</h4>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {discover.aiSuggestions.improvedTitle?.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                    <h4 className="font-semibold mt-4 mb-1">AI Intros</h4>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {discover.aiSuggestions.improvedIntro?.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border p-4">
                    <h4 className="font-semibold mb-1">Lead Image Briefs</h4>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {discover.aiSuggestions.imageBriefs?.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                    {discover.aiSuggestions.schemaPatch && (
                      <>
                        <h4 className="font-semibold mt-4 mb-1">JSON-LD Patch</h4>
                        <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-2 rounded-lg border">
                          {JSON.stringify(discover.aiSuggestions.schemaPatch, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                </div>
              )}

              {discover.aiSuggestions?.checklist && (
                <div className="rounded-xl border p-4">
                  <h4 className="font-semibold mb-1">High-Impact Checklist</h4>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {discover.aiSuggestions.checklist.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        // OVERVIEW (default)
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Basics</h3>
              <div className="grid grid-cols-[130px_1fr] gap-y-3 gap-x-3 text-sm text-gray-700">
                <div className="font-medium">Title</div>
                <div>{data.title || <i>—</i>}</div>

                <div className="font-medium">Description</div>
                <div>{data.metaDescription || <i>—</i>}</div>

                <div className="font-medium">Canonical</div>
                <div className="flex flex-wrap gap-2 items-center">
                  {data.canonical || <i>—</i>}
                  {data.canonicalStatus && (
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        data.canonicalStatus === "Valid"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {data.canonicalStatus}
                    </span>
                  )}
                </div>

                <div className="font-medium">HTTP Status</div>
                <div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      data.http?.status
                    )}`}
                  >
                    {data.http?.status ?? "—"}
                  </span>
                </div>

                <div className="font-medium">X-Robots-Tag</div>
                <div>{data.http?.xRobotsTag || <i>—</i>}</div>

                <div className="font-medium">Robots</div>
                <div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRobotsColor(
                      data.robotsMeta,
                      data.robots
                    )}`}
                  >
                    {data.robotsMeta
                      ? `${data.robotsMeta.index ? "index" : "noindex"}, ${
                          data.robotsMeta.follow ? "follow" : "nofollow"
                        }${data.robotsMeta.raw ? ` (${data.robotsMeta.raw})` : ""}`
                      : data.robots || "—"}
                  </span>
                </div>

                <div className="font-medium">Viewport</div>
                <div>{data.viewport || <i>—</i>}</div>

                <div className="font-medium">Lang</div>
                <div>{data.lang || <i>—</i>}</div>

                <div className="font-medium">Headings</div>
                <div>
                  H1 {data.h1Count ?? 0} · H2 {data.headings?.h2 ?? 0} · H3 {data.headings?.h3 ?? 0}
                </div>

                <div className="font-medium">Hreflang</div>
                <div>{(data.hreflang || []).join(", ") || <i>—</i>}</div>
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Links & Images</h3>
              <div className="grid grid-cols-[130px_1fr] gap-y-3 gap-x-3 text-sm text-gray-700">
                <div className="font-medium">Links (Total)</div>
                <div>{Links.total ?? 0}</div>

                <div className="font-medium">Internal</div>
                <div>{Links.internal ?? 0}</div>

                <div className="font-medium">External</div>
                <div>{Links.external ?? 0}</div>

                <div className="font-medium">Nofollow</div>
                <div>{Links.nofollow ?? 0}</div>

                <div className="font-medium">Images (missing alt)</div>
                <div>{data.images?.missingAlt ?? 0}</div>
              </div>
            </section>

            {(data._issues?.length || data._warnings?.length) && (
              <section className="bg-white rounded-xl shadow-sm p-5 space-y-3 md:col-span-2">
                <h3 className="text-lg font-semibold border-b pb-2">All Findings</h3>
                <OverviewFindings data={data} />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
