'use client';

import React, { useState } from 'react';

import ScorePills from './ScorePills';
import IndexingCard from './IndexingCard';
import LinkCheckerCard from './LinkCheckerCard';
import PsiCard from './PsiCard';
import SitemapCard from './SitemapCard';
import RedirectsCard from './RedirectsCard';
import RobotsCard from './RobotsCard';
import HreflangCard from './HreflangCard';
import CanonicalizeCard from './CanonicalizeCard';
import ImageAuditCard from './ImageAuditCard';
import HeadersCard from './HeadersCard';
import AmpCard from './AmpCard';

// Helper component for displaying findings to reduce code duplication
const FindingsList = ({ title, warnings, issues, filterRegex }) => {
  const filteredWarnings = (warnings || []).filter(w => filterRegex.test(w));
  const filteredIssues = (issues || []).filter(w => filterRegex.test(w));

  if (filteredWarnings.length === 0 && filteredIssues.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="font-semibold mb-3">{title}</h3>
      <ul className="list-disc pl-6 space-y-1">
        {filteredWarnings.map((w, i) => (
          <li key={'w' + i} className="text-amber-700">⚠️ {w}</li>
        ))}
        {filteredIssues.map((w, i) => (
          <li key={'e' + i} className="text-red-700">❌ {w}</li>
        ))}
      </ul>
    </section>
  );
};

export default function ResultCard({ data }:{ data:any }){
  const [tab, setTab] = useState<string>('overview');

  const Links = data.links || {};
  const og = data.og || {};
  const tw = data.twitter || {};

  const tabs = [
    { key:'overview', label:'Overview' },
    { key:'content', label:'Content' },
    { key:'links', label:'Links' },
    { key:'structured', label:'Structured Data' },
    { key:'technical', label:'Technical' },
    { key:'indexing', label:'Indexing' },
    { key:'performance', label:'Performance' }
  ];

  const TabNav = () => (
    <div className="tablist">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={()=>setTab(t.key)}
          className={`tab ${tab===t.key ? 'tab-active' : ''}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  // Helper function to format robots content
  const getRobotsContent = (robotsMeta, robots) => {
    if (robotsMeta) {
      const index = robotsMeta.index ? 'index' : 'noindex';
      const follow = robotsMeta.follow ? 'follow' : 'nofollow';
      const raw = robotsMeta.raw ? ` (${robotsMeta.raw})` : '';
      return `${index}, ${follow}${raw}`;
    }
    return robots || '—';
  };

  return (
    <div className="card p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm text-gray-500">Scanned</div>
          <div className="text-lg font-semibold">{data.finalUrl || data.url}</div>
          {data.redirected && data.finalUrl !== data.url && (
            <div className="text-xs text-gray-500">Redirected from: {data.url}</div>
          )}
        </div>
        <ScorePills data={data} />
      </div>

      <TabNav />

      {/* OVERVIEW */}
      {tab==='overview' && (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <section>
              <h3 className="font-semibold mb-3">Basics</h3>
              <div className="kv">
                <div className="k">Title</div>
                <div className="v">{data.title || <i>—</i>}</div>

                <div className="k">Description</div>
                <div className="v">{data.metaDescription || <i>—</i>}</div>

                <div className="k">Canonical</div>
                <div className="v">
                  {data.canonical || <i>—</i>}
                  {data.canonicalStatus && <span className="badge ml-2">{data.canonicalStatus}</span>}
                </div>

                <div className="k">HTTP Status</div>
                <div className="v">{data.http?.status ?? '—'}</div>

                <div className="k">X-Robots-Tag</div>
                <div className="v">{data.http?.xRobotsTag || <i>—</i>}</div>

                <div className="k">Robots</div>
                <div className="v">{getRobotsContent(data.robotsMeta, data.robots)}</div>

                <div className="k">Viewport</div>
                <div className="v">{data.viewport || <i>—</i>}</div>

                <div className="k">Lang</div>
                <div className="v">{data.lang || <i>—</i>}</div>

                <div className="k">Headings</div>
                <div className="v">H1 {data.h1Count ?? 0} · H2 {data.headings?.h2 ?? 0} · H3 {data.headings?.h3 ?? 0}</div>

                <div className="k">Hreflang</div>
                <div className="v">{(data.hreflang||[]).join(', ') || <i>—</i>}</div>
              </div>
            </section>

            <section>
              <h3 className="font-semibold mb-3">Links & Images</h3>
              <div className="kv">
                <div className="k">Links (Total)</div><div className="v">{Links.total ?? 0}</div>
                <div className="k">Internal</div><div className="v">{Links.internal ?? 0}</div>
                <div className="k">External</div><div className="v">{Links.external ?? 0}</div>
                <div className="k">Nofollow</div><div className="v">{Links.nofollow ?? 0}</div>
                <div className="k">Images (missing alt)</div><div className="v">{data.images?.missingAlt ?? 0}</div>
              </div>
            </section>
          </div>

          <FindingsList
            title="All Findings"
            warnings={data._warnings}
            issues={data._issues}
            filterRegex={/.*/}
          />
        </>
      )}

      {/* CONTENT */}
      {tab==='content' && (
        <>
          <section>
            <h3 className="font-semibold mb-3">Open Graph</h3>
            <pre className="code">{JSON.stringify(og, null, 2)}</pre>
          </section>
          <section>
            <h3 className="font-semibold mb-3">Twitter</h3>
            <pre className="code">{JSON.stringify(tw, null, 2)}</pre>
          </section>
          <section>
            <h3 className="font-semibold mb-3">Images Audit</h3>
            <ImageAuditCard url={data.finalUrl || data.url} />
          </section>
          <section>
            <h3 className="font-semibold mb-3">Schema Types</h3>
            <div>{(data.schemaTypes||[]).length ? data.schemaTypes.join(', ') : <i>—</i>}</div>
          </section>
          <FindingsList
            title="Findings (Content)"
            warnings={data._warnings}
            issues={data._issues}
            filterRegex={/title|description|h1|og|twitter|image/i}
          />
        </>
      )}

      {/* LINKS */}
      {tab==='links' && (
        <>
          <section>
            <h3 className="font-semibold mb-3">Links</h3>
            <div className="kv">
              <div className="k">Total</div><div className="v">{Links.total ?? 0}</div>
              <div className="k">Internal</div><div className="v">{Links.internal ?? 0}</div>
              <div className="k">External</div><div className="v">{Links.external ?? 0}</div>
              <div className="k">Nofollow</div><div className="v">{Links.nofollow ?? 0}</div>
            </div>
          </section>
          <LinkCheckerCard url={data.finalUrl || data.url} />
        </>
      )}

      {/* STRUCTURED DATA */}
      {tab==='structured' && (
        <>
          <section>
            <h3 className="font-semibold mb-3">Schema Types</h3>
            <div>{(data.schemaTypes||[]).length ? data.schemaTypes.join(', ') : <i>—</i>}</div>
          </section>
        </>
      )}

      {/* TECHNICAL */}
      {tab === 'technical' && (
        <>
          <section>
            <h3 className="font-semibold mb-3">Technical Basics</h3>
            <div className="kv">
              <div className="k">Viewport</div><div className="v">{data.viewport || <i>—</i>}</div>
              <div className="k">Lang</div><div className="v">{data.lang || <i>—</i>}</div>
              <div className="k">Robots</div>
              <div className="v">{getRobotsContent(data.robotsMeta, data.robots)}</div>
            </div>
          </section>
          <FindingsList
            title="Findings (Technical)"
            warnings={data._warnings}
            issues={data._issues}
            filterRegex={/(canonical|viewport|lang|robots|render-?blocking|security|mixed\s*content|https?\b)/i}
          />
          <CanonicalizeCard url={data.finalUrl || data.url} />
          <AmpCard url={data.finalUrl || data.url} />
          <RedirectsCard url={data.finalUrl || data.url} />
          <RobotsCard url={data.finalUrl || data.url} />
          <HeadersCard url={data.finalUrl || data.url} />
        </>
      )}

      {/* INDEXING */}
      {tab === 'indexing' && (
        <>
          <IndexingCard url={data.finalUrl || data.url} />
          <SitemapCard url={data.finalUrl || data.url} />
          <HreflangCard url={data.finalUrl || data.url} />
        </>
      )}

      {/* PERFORMANCE */}
      {tab==='performance' && <PsiCard url={data.finalUrl || data.url} />}
    </div>
  );
}
