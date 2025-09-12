'use client';

import React, { useState } from 'react';
import ScorePills from './ScorePills';
import PsiCard from './PsiCard';
import IndexingCard from './IndexingCard';

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
    <div className="border-b border-gray-200 -mb-px">
      <nav className="-mb-px flex flex-wrap gap-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={()=>setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab===t.key ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="card p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm text-gray-500">Scanned</div>
          <div className="text-lg font-semibold">{data.finalUrl || data.url}</div>
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
                <div className="k">Title</div><div className="v">{data.title || <i>—</i>}</div>
                <div className="k">Description</div><div className="v">{data.metaDescription || <i>—</i>}</div>
                <div className="k">Canonical</div><div className="v">{data.canonical || <i>—</i>}</div>
                <div className="k">Robots</div><div className="v">{data.robots || <i>—</i>}</div>
                <div className="k">Viewport</div><div className="v">{data.viewport || <i>—</i>}</div>
                <div className="k">Lang</div><div className="v">{data.lang || <i>—</i>}</div>
                <div className="k">H1 Count</div><div className="v">{data.h1Count}</div>
                <div className="k">Hreflang</div><div className="v">{(data.hreflang||[]).join(', ') || <i>—</i>}</div>
              </div>
            </section>
            <section>
              <h3 className="font-semibold mb-3">Links</h3>
              <div className="kv">
                <div className="k">Total</div><div className="v">{Links.total}</div>
                <div className="k">Internal</div><div className="v">{Links.internal}</div>
                <div className="k">External</div><div className="v">{Links.external}</div>
                <div className="k">Nofollow</div><div className="v">{Links.nofollow}</div>
                <div className="k">Images (missing alt)</div><div className="v">{data.images?.missingAlt ?? 0}</div>
              </div>
            </section>
          </div>
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
                {(data._issues||[]).map((w:string, i:number)=>(<li key={'ce'+i} className="text-red-700">❌ {w}</li>))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {/* LINKS */}
      {tab==='links' && (
        <section>
          <h3 className="font-semibold mb-3">Links</h3>
          <div className="kv">
            <div className="k">Total</div><div className="v">{Links.total}</div>
            <div className="k">Internal</div><div className="v">{Links.internal}</div>
            <div className="k">External</div><div className="v">{Links.external}</div>
            <div className="k">Nofollow</div><div className="v">{Links.nofollow}</div>
          </div>
        </section>
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
      {tab==='technical' && (
        <>
          <section>
            <h3 className="font-semibold mb-3">Technical Basics</h3>
            <div className="kv">
              <div className="k">Viewport</div><div className="v">{data.viewport || <i>—</i>}</div>
              <div className="k">Lang</div><div className="v">{data.lang || <i>—</i>}</div>
              <div className="k">Robots</div><div className="v">{data.robots || <i>—</i>}</div>
            </div>
          </section>
          {(data._issues?.length || data._warnings?.length) ? (
            <section>
              <h3 className="font-semibold mb-3">Findings (Technical)</h3>
              <ul className="list-disc pl-6 space-y-1">
                {(data._warnings||[]).filter((w:string)=>/canonical|viewport|lang|robots|render-blocking/i.test(w)).map((w:string, i:number)=>(<li key={'tw'+i} className="text-amber-700">⚠️ {w}</li>))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {/* INDEXING */}
      {tab==='indexing' && <IndexingCard url={data.finalUrl || data.url} />}

      {/* PERFORMANCE */}
      {tab==='performance' && <PsiCard url={data.finalUrl || data.url} />}

      {/* FALLBACK: show all findings if user is on overview */}
      {tab==='overview' && (data._issues?.length || data._warnings?.length) ? (
        <section>
          <h3 className="font-semibold mb-3">All Findings</h3>
          <ul className="list-disc pl-6 space-y-1">
            {(data._warnings||[]).map((w:string, i:number)=>(<li key={'w'+i} className="text-amber-700">⚠️ {w}</li>))}
            {(data._issues||[]).map((w:string, i:number)=>(<li key={'e'+i} className="text-red-700">❌ {w}</li>))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
