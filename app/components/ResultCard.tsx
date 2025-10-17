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
import DiscoverCard from './components/cards/DiscoverCard';

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">SEO Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* your existing cards… */}
        <Suspense fallback={<div className="rounded-2xl border p-5">Loading…</div>}>
          <DiscoverCard />
        </Suspense>
      </div>
    </div>
  );
}

type Details = {
  imagesMissingAlt?: string[];
  imagesNoLazy?: string[];
  imagesNoSize?: string[];
  scriptsHeadBlocking?: string[];
  linksAll?: string[];
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
  ] as const;

  type TabKey = typeof tabs[number]["key"];
  const [active, setActive] = useState<TabKey>("overview");

  const pageUrl: string = data.finalUrl || data.url;
  const Links = data.links || {};
  const og = data.og || {};
  const tw = data.twitter || {};
  // If you need later:
  // const warnings: string[] = data?._warnings ?? [];
  // const details: Details = (data?.details ?? {}) as Details;

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
