'use client';
import ScorePills from './ScorePills';

export default function ResultCard({ data }:{ data:any }){
  const Links = data.links || {};
  const og = data.og || {};
  const tw = data.twitter || {};
  return (
    <div className="card p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm text-gray-500">Scanned</div>
          <div className="text-lg font-semibold">{data.finalUrl || data.url}</div>
        </div>
        <ScorePills data={data} />
      </div>

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
          <h3 className="font-semibold mb-3">Findings</h3>
          <ul className="list-disc pl-6 space-y-1">
            {(data._warnings||[]).map((w:string, i:number)=>(<li key={'w'+i} className="text-amber-700">⚠️ {w}</li>))}
            {(data._issues||[]).map((w:string, i:number)=>(<li key={'e'+i} className="text-red-700">❌ {w}</li>))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
