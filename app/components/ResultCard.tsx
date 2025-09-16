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
import RenderCompareCard from './RenderCompareCard';
import CwvCard from './CwvCard';
import CrawlHintsCard from './CrawlHintsCard';


export default function ResultCard({ data }: { data: any }) {
  const [tab, setTab] = useState<string>("overview");
  const Links = data.links || {};
  const og = data.og || {};
  const tw = data.twitter || {};

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "content", label: "Content" },
    { key: "links", label: "Links" },
    { key: "structured", label: "Structured Data" },
    { key: "technical", label: "Technical" },
    { key: "indexing", label: "Indexing" },
    { key: "performance", label: "Performance" },
  ];

  const getStatusColor = (status: number | undefined) => {
    if (!status) return "bg-gray-100 text-gray-600";
    if (status >= 200 && status < 300) return "bg-green-100 text-green-700";
    if (status >= 300 && status < 400) return "bg-blue-100 text-blue-700";
    if (status >= 400 && status < 500) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  const getRobotsColor = (robotsMeta: any, robots: string) => {
    if (!robotsMeta && !robots) return "bg-gray-100 text-gray-600";
    const isNoIndex = robotsMeta?.index === false || /noindex/i.test(robots);
    return isNoIndex
      ? "bg-red-100 text-red-700"
      : "bg-green-100 text-green-700";
  };

  const TabNav = () => (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`px-4 py-2 rounded-t-xl text-sm font-medium transition-all duration-200 ${
            tab === t.key
              ? "bg-blue-50 text-blue-700 border-b-2 border-blue-500"
              : "hover:bg-gray-50 text-gray-600"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="bg-gray-50 rounded-2xl shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Scanned
          </div>
          <div className="text-lg font-semibold break-all text-gray-800">
            {data.finalUrl || data.url}
          </div>
          {data.redirected && data.finalUrl !== data.url && (
            <div className="text-xs text-gray-500">
              Redirected from: {data.url}
            </div>
          )}
        </div>
        <ScorePills data={data} />
      </div>

      <TabNav />

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Basics */}
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
                H1 {data.h1Count ?? 0} · H2 {data.headings?.h2 ?? 0} · H3{" "}
                {data.headings?.h3 ?? 0}
              </div>

              <div className="font-medium">Hreflang</div>
              <div>{(data.hreflang || []).join(", ") || <i>—</i>}</div>
            </div>
          </section>

          {/* Links & Images */}
          <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">
              Links & Images
            </h3>
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

          {/* Findings */}
          {(data._issues?.length || data._warnings?.length) && (
            <section className="bg-white rounded-xl shadow-sm p-5 space-y-3 md:col-span-2">
              <h3 className="text-lg font-semibold border-b pb-2">
                All Findings
              </h3>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                {(data._warnings || []).map((w: string, i: number) => (
                  <li key={"w" + i} className="text-amber-700">
                    ⚠️ {w}
                  </li>
                ))}
                {(data._issues || []).map((w: string, i: number) => (
                  <li key={"e" + i} className="text-red-700">
                    ❌ {w}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Other Tabs unchanged except styling */}
      {tab === "content" && (
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

          <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Images Audit</h3>
            <ImageAuditCard url={data.finalUrl || data.url} />
            <h3 className="text-lg font-semibold mt-4 mb-3">Schema Types</h3>
            <div>{(data.schemaTypes || []).join(", ") || <i>—</i>}</div>
          </section>
        </>
      )}

      {tab === "links" && (
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
          {data.finalUrl || data.url ? (
            <LinkCheckerCard url={data.finalUrl || data.url} />
          ) : null}
        </>
      )}

      {tab === "structured" && (
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-lg font-semibold border-b pb-2">Schema Types</h3>
          <div className="pt-2">{(data.schemaTypes || []).join(", ") || <i>—</i>}</div>
        </section>
      )}

      {tab === "technical" && (
        <>
          <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">
              Technical Basics
            </h3>
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
                      }`
                    : data.robots || "—"}
                </span>
              </div>
            </div>
          </section>
          <CrawlHintsCard url={data.finalUrl || data.url} />
          <CanonicalizeCard url={data.finalUrl || data.url} />
         <RenderCompareCard url={data.finalUrl || data.url} />
          <AmpCard url={data.finalUrl || data.url} />
          <RedirectsCard url={data.finalUrl || data.url} />
          <RobotsCard url={data.finalUrl || data.url} />
          <HeadersCard url={data.finalUrl || data.url} />
        </>
      )}

      {tab === "indexing" && (
        <>
          <IndexingCard url={data.finalUrl || data.url} />
          <SitemapCard url={data.finalUrl || data.url} />
          <HreflangCard url={data.finalUrl || data.url} />
        </>
      )}

      {tab === "performance" && <PsiCard url={data.finalUrl || data.url} />}
     
    </div>
  );
}
