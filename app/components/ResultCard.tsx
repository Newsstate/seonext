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

  const TabNav = () => (
    <div className="flex flex-wrap gap-3 border-b pb-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`px-3 py-1 rounded-t-md border-b-2 transition-colors ${
            tab === t.key
              ? "border-blue-500 font-semibold text-blue-600"
              : "border-transparent hover:border-gray-300"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="card p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm text-gray-500">Scanned</div>
          <div className="text-lg font-semibold break-all">
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
          <section className="bg-white rounded-xl shadow p-4 space-y-3">
            <h3 className="font-semibold mb-3">Basics</h3>
            <div className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3 text-sm">
              <div className="font-semibold">Title</div>
              <div>{data.title || <i>—</i>}</div>

              <div className="font-semibold">Description</div>
              <div>{data.metaDescription || <i>—</i>}</div>

              <div className="font-semibold">Canonical</div>
              <div>
                {data.canonical || <i>—</i>}
                {data.canonicalStatus && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 rounded">
                    {data.canonicalStatus}
                  </span>
                )}
              </div>

              <div className="font-semibold">HTTP Status</div>
              <div>{data.http?.status ?? "—"}</div>

              <div className="font-semibold">X-Robots-Tag</div>
              <div>{data.http?.xRobotsTag || <i>—</i>}</div>

              <div className="font-semibold">Robots</div>
              <div>
                {data.robotsMeta
                  ? `${data.robotsMeta.index ? "index" : "noindex"}, ${
                      data.robotsMeta.follow ? "follow" : "nofollow"
                    }${data.robotsMeta.raw ? ` (${data.robotsMeta.raw})` : ""}`
                  : data.robots || <i>—</i>}
              </div>

              <div className="font-semibold">Viewport</div>
              <div>{data.viewport || <i>—</i>}</div>

              <div className="font-semibold">Lang</div>
              <div>{data.lang || <i>—</i>}</div>

              <div className="font-semibold">Headings</div>
              <div>
                H1 {data.h1Count ?? 0} · H2 {data.headings?.h2 ?? 0} · H3{" "}
                {data.headings?.h3 ?? 0}
              </div>

              <div className="font-semibold">Hreflang</div>
              <div>{(data.hreflang || []).join(", ") || <i>—</i>}</div>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow p-4 space-y-3">
            <h3 className="font-semibold mb-3">Links & Images</h3>
            <div className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3 text-sm">
              <div className="font-semibold">Links (Total)</div>
              <div>{Links.total ?? 0}</div>

              <div className="font-semibold">Internal</div>
              <div>{Links.internal ?? 0}</div>

              <div className="font-semibold">External</div>
              <div>{Links.external ?? 0}</div>

              <div className="font-semibold">Nofollow</div>
              <div>{Links.nofollow ?? 0}</div>

              <div className="font-semibold">Images (missing alt)</div>
              <div>{data.images?.missingAlt ?? 0}</div>
            </div>
          </section>

          {(data._issues?.length || data._warnings?.length) && (
            <section className="bg-white rounded-xl shadow p-4 space-y-3 md:col-span-2">
              <h3 className="font-semibold mb-3">All Findings</h3>
              <ul className="list-disc pl-6 space-y-1">
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

      {/* CONTENT TAB */}
      {tab === "content" && (
        <>
          <section className="bg-white rounded-xl shadow p-4 space-y-3">
            <h3 className="font-semibold mb-3">Open Graph</h3>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
              {JSON.stringify(og, null, 2)}
            </pre>
          </section>

          <section className="bg-white rounded-xl shadow p-4 space-y-3">
            <h3 className="font-semibold mb-3">Twitter</h3>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
              {JSON.stringify(tw, null, 2)}
            </pre>
          </section>

          <section className="bg-white rounded-xl shadow p-4 space-y-3">
            <h3 className="font-semibold mb-3">Images Audit</h3>
            <ImageAuditCard url={data.finalUrl || data.url} />
            <h3 className="font-semibold mt-4 mb-3">Schema Types</h3>
            <div>{(data.schemaTypes || []).join(", ") || <i>—</i>}</div>
          </section>

          {(data._issues?.length || data._warnings?.length) && (
            <section className="bg-white rounded-xl shadow p-4 space-y-3">
              <h3 className="font-semibold mb-3">Findings (Content)</h3>
              <ul className="list-disc pl-6 space-y-1">
                {(data._warnings || [])
                  .filter((w: string) =>
                    /title|description|h1|og|twitter|image/i.test(w)
                  )
                  .map((w: string, i: number) => (
                    <li key={"cw" + i} className="text-amber-700">
                      ⚠️ {w}
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* LINKS TAB */}
      {tab === "links" && (
        <>
          <section className="bg-white rounded-xl shadow p-4 space-y-3">
            <h3 className="font-semibold mb-3">Links</h3>
            <div className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3 text-sm">
              <div className="font-semibold">Total</div>
              <div>{Links.total ?? 0}</div>

              <div className="font-semibold">Internal</div>
              <div>{Links.internal ?? 0}</div>

              <div className="font-semibold">External</div>
              <div>{Links.external ?? 0}</div>

              <div className="font-semibold">Nofollow</div>
              <div>{Links.nofollow ?? 0}</div>
            </div>
          </section>
          {data.finalUrl || data.url ? (
            <LinkCheckerCard url={data.finalUrl || data.url} />
          ) : null}
        </>
      )}

      {/* STRUCTURED DATA TAB */}
      {tab === "structured" && (
        <section className="bg-white rounded-xl shadow p-4 space-y-3">
          <h3 className="font-semibold mb-3">Schema Types</h3>
          <div>{(data.schemaTypes || []).join(", ") || <i>—</i>}</div>
        </section>
      )}

      {/* TECHNICAL TAB */}
      {tab === "technical" && (
        <>
          <section className="bg-white rounded-xl shadow p-4 space-y-3">
            <h3 className="font-semibold mb-3">Technical Basics</h3>
            <div className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3 text-sm">
              <div className="font-semibold">Viewport</div>
              <div>{data.viewport || <i>—</i>}</div>

              <div className="font-semibold">Lang</div>
              <div>{data.lang || <i>—</i>}</div>

              <div className="font-semibold">Robots</div>
              <div>
                {data.robotsMeta
                  ? `${data.robotsMeta.index ? "index" : "noindex"}, ${
                      data.robotsMeta.follow ? "follow" : "nofollow"
                    }`
                  : data.robots || <i>—</i>}
              </div>
            </div>
          </section>

          {(data._issues?.length || data._warnings?.length) && (
            <section className="bg-white rounded-xl shadow p-4 space-y-3">
              <h3 className="font-semibold mb-3">Findings (Technical)</h3>
              <ul className="list-disc pl-6 space-y-1">
                {(data._warnings || [])
                  .filter((w: string) =>
                    /(canonical|viewport|lang|robots|render-?blocking|security|mixed\s*content|https?\b)/i.test(
                      w
                    )
                  )
                  .map((w: string, i: number) => (
                    <li key={"tw" + i} className="text-amber-700">
                      ⚠️ {w}
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <CanonicalizeCard url={data.finalUrl || data.url} />
          <AmpCard url={data.finalUrl || data.url} />
          <RedirectsCard url={data.finalUrl || data.url} />
          <RobotsCard url={data.finalUrl || data.url} />
          <HeadersCard url={data.finalUrl || data.url} />
        </>
      )}

      {/* INDEXING TAB */}
      {tab === "indexing" && (
        <>
          <IndexingCard url={data.finalUrl || data.url} />
          <SitemapCard url={data.finalUrl || data.url} />
          <HreflangCard url={data.finalUrl || data.url} />
        </>
      )}

      {/* PERFORMANCE TAB */}
      {tab === "performance" && <PsiCard url={data.finalUrl || data.url} />}
    </div>
  );
}
