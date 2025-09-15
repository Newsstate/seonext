'use client';

import React, { useState } from 'react';
import ScorePills from './ScorePills';
import IndexingCard from './IndexingCard';
import LinkCheckerCard from './LinkCheckerCard'; // remove if you didn't add it
import PsiCard from './PsiCard'; // remove this + tab below if you don't want PSI yet
import SitemapCard from './SitemapCard';
import RedirectsCard from './RedirectsCard';
import RobotsCard from './RobotsCard';
import HreflangCard from './HreflangCard';
import CanonicalizeCard from './CanonicalizeCard';
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
    { key:'performance', label:'Performance' } // remove if not using PsiCard
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
                <div className="v">
                  {data.robotsMeta
                    ? `${data.robotsMeta.index ? 'index' : 'noindex'}, ${data.robotsMeta.follow ? 'follow' : 'nofollow'}${data.robotsMeta.raw ? ` (${data.robotsMeta.raw})` : ''}`
                    : (data.robots || <i>—</i>)
                  }
                </div>

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

          {(data._issues?.length || data._warnings?.length) ? (
            <section>
              <h3 className="font-semibold mb-3">All Findings</h3>
              <ul className="list-disc pl-6 space-y-1">
                {(data._warnings||[]).map((w:string, i:number)=>(<li key={'w'+i} className="text-amber-700">⚠️ {w}</li>))}
                {(data._issues||[]).map((w:string, i:number)=>(<li key={'e'+i} className="text-red-700">❌ {w}</li>))}
              </ul>
            </section>
          ) : null}
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
            <h3 className="font-semibold mb-3">Schema Types</h3>
            <div>{(data.schemaTypes||[]).length ? data.schemaTypes.join(', ') : <i>—</i>}</div>
          </section>
          {(data._issues?.length || data._warnings?.length) ? (
            <section>
              <h3 className="font-semibold mb-3">Findings (Content)</h3>
              <ul className="list-disc pl-6 space-y-1">
                {(data._warnings||[]).filter((w:string)=>/title|description|h1|og|twitter|image/i.test(w)).map((w:string, i:number)=>(<li key={'cw'+i} className="text-amber-700">⚠️ {w}</li>))}
              </ul>
            </section>
          ) : null}
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

          {/* Optional full table via LinkChecker */}
          {data.finalUrl || data.url ? (
            <LinkCheckerCard url={data.finalUrl || data.url} />
          ) : null}
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
        <div className="v">
          {data.robotsMeta
            ? `${data.robotsMeta.index ? 'index' : 'noindex'}, ${data.robotsMeta.follow ? 'follow' : 'nofollow'}`
            : (data.robots || <i>—</i>)}
        </div>
      </div>
    </section>

    {(data._issues?.length || data._warnings?.length) && (
      <section>
        <h3 className="font-semibold mb-3">Findings (Technical)</h3>
        <ul className="list-disc pl-6 space-y-1">
          {(data._warnings || [])
            .filter((w: string) =>
              /(canonical|viewport|lang|robots|render-?blocking|security|mixed\s*content|https?\b)/i.test(w)
            )
            .map((w: string, i: number) => (
              <li key={'tw' + i} className="text-amber-700">⚠️ {w}</li>
            ))}
        </ul>
      </section>
    )}
    <CanonicalizeCard url={data.finalUrl || data.url} />

    <RedirectsCard url={data.finalUrl || data.url} />
    <RobotsCard    url={data.finalUrl || data.url} />
  </>
)}


     {/* INDEXING */}
{tab === 'indexing' && (
  <>
    <IndexingCard url={data.finalUrl || data.url} />
    <SitemapCard  url={data.finalUrl || data.url} />
        <HreflangCard url={data.finalUrl || data.url} />
  </>
)}

      {/* PERFORMANCE */}
      {tab==='performance' && <PsiCard url={data.finalUrl || data.url} />}
    </div>
  );
}
