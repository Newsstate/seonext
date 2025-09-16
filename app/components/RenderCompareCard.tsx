'use client';
import React, { useState } from 'react';

type DiffRow = { key: string; a: any; b: any; same: boolean };

// NEW: detailed diffs shape
type DiffsExpanded = {
  links: {
    added: string[]; removed: string[];
    addedInternal: string[]; removedInternal: string[];
    addedExternal: string[]; removedExternal: string[];
    addedNofollow: string[]; removedNofollow: string[];
    counts: {
      noJs: { all: number; internal: number; external: number; nofollow: number };
      rendered: { all: number; internal: number; external: number; nofollow: number };
    };
  };
  imagesMissingAlt: {
    added: string[]; removed: string[];
    counts: { noJs: number; rendered: number };
  };
  headings: {
    h1: { added: string[]; removed: string[] };
    h2: { added: string[]; removed: string[] };
    h3: { added: string[]; removed: string[] };
    counts: {
      noJs: { h1: number; h2: number; h3: number };
      rendered: { h1: number; h2: number; h3: number };
    };
  };
  schemaTypes: {
    added: string[]; removed: string[];
    counts: { noJs: number; rendered: number };
  };
  hreflang: {
    added: string[]; removed: string[];
    counts: { noJs: number; rendered: number };
  };
};

export default function RenderCompareCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [res, setRes] = useState<null | {
    noJs: { url:string; status:number|null; domSize:number; words:number; };
    rendered: { url:string; status:number|null; domSize:number; words:number; };
    summary: { textSimilarity:number; domDelta:number; wordsDelta:number; keyChangesCount:number; hasGranularChanges?: boolean }; // extended
    diffs: DiffRow[];
    diffsExpanded?: DiffsExpanded; // NEW
  }>(null);

  const [waitUntil, setWaitUntil] =
    useState<'domcontentloaded'|'networkidle0'|'networkidle2'|'load'>('networkidle0');

  const run = async () => {
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/render-compare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, waitUntil }),
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed');
      else setRes(j.data);
    } catch (e:any) {
      setErr(String(e.message||e));
    } finally {
      setLoading(false);
    }
  };

  const Badge = ({ ok, yes='Yes', no='No' }:{ ok:boolean; yes?:string; no?:string }) =>
    <span className={`badge ml-2 ${ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{ok?yes:no}</span>;

  // NEW: tiny helper for lists
  const List = ({ title, items }:{ title:string; items?:string[] }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-3">
        <h4 className="font-semibold text-sm mb-1">{title}</h4>
        <ul className="list-disc pl-6 break-all text-sm">
          {items.map((x, i) => (
            <li key={i}>
              {/^https?:\/\//i.test(x) ? <a href={x} target="_blank" rel="noreferrer">{x}</a> : x}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Render vs No-JS Diff</h3>
        <div className="flex items-center gap-2">
          <select className="input" value={waitUntil} onChange={e=>setWaitUntil(e.target.value as any)}>
            <option value="domcontentloaded">domcontentloaded</option>
            <option value="load">load</option>
            <option value="networkidle0">networkidle0</option>
            <option value="networkidle2">networkidle2</option>
          </select>
          <button className="btn" onClick={run} disabled={loading || !url}>
            {loading ? 'Comparing…' : 'Run'}
          </button>
        </div>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {res && (
        <>
          <div className="kv">
            <div className="k">No-JS URL</div><div className="v break-all">{res.noJs.url}</div>
            <div className="k">Rendered URL</div><div className="v break-all">{res.rendered.url}</div>
            <div className="k">No-JS Status</div><div className="v">{res.noJs.status ?? '—'}</div>
            <div className="k">Rendered Status</div><div className="v">{res.rendered.status ?? '—'}</div>
            <div className="k">No-JS DOM size</div><div className="v">{res.noJs.domSize}</div>
            <div className="k">Rendered DOM size</div><div className="v">{res.rendered.domSize} (Δ {res.summary.domDelta>=0?'+':''}{res.summary.domDelta})</div>
            <div className="k">No-JS words</div><div className="v">{res.noJs.words}</div>
            <div className="k">Rendered words</div><div className="v">{res.rendered.words} (Δ {res.summary.wordsDelta>=0?'+':''}{res.summary.wordsDelta})</div>
            <div className="k">Text similarity</div>
            <div className="v">
              {res.summary.textSimilarity.toFixed(3)}
              <Badge ok={res.summary.textSimilarity >= 0.85} yes="High" no="Low" />
            </div>
            <div className="k">Changed fields</div><div className="v">{res.summary.keyChangesCount}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th className="th-pro">Field</th>
                  <th className="th-pro">No-JS</th>
                  <th className="th-pro">Rendered</th>
                  <th className="th-pro">Same?</th>
                </tr>
              </thead>
              <tbody>
                {res.diffs.map((d, i)=>(
                  <tr key={i} className={d.same ? '' : 'text-amber-700'}>
                    <td className="td-pro">{d.key}</td>
                    <td className="td-pro break-all">{(d.a ?? '—').toString()}</td>
                    <td className="td-pro break-all">{(d.b ?? '—').toString()}</td>
                    <td className="td-pro">{d.same ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* NEW: Granular differences */}
          {res.diffsExpanded && (
            <div className="space-y-6">
              {/* Links */}
              <section className="p-4 rounded-lg border">
                <h3 className="font-bold text-base mb-2">Exact link differences</h3>
                <div className="text-xs text-gray-500 mb-3">
                  No-JS total: {res.diffsExpanded.links.counts.noJs.all} · Rendered total: {res.diffsExpanded.links.counts.rendered.all}
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <List title="Added (rendered only)" items={res.diffsExpanded.links.added} />
                    <List title="Added (internal)" items={res.diffsExpanded.links.addedInternal} />
                    <List title="Added (external)" items={res.diffsExpanded.links.addedExternal} />
                    <List title="Added (nofollow)" items={res.diffsExpanded.links.addedNofollow} />
                  </div>
                  <div>
                    <List title="Removed (present in no-JS)" items={res.diffsExpanded.links.removed} />
                    <List title="Removed (internal)" items={res.diffsExpanded.links.removedInternal} />
                    <List title="Removed (external)" items={res.diffsExpanded.links.removedExternal} />
                    <List title="Removed (nofollow)" items={res.diffsExpanded.links.removedNofollow} />
                  </div>
                </div>
              </section>

              {/* Headings */}
              <section className="p-4 rounded-lg border">
                <h3 className="font-bold text-base mb-2">Heading text changes</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <List title="H1 added" items={res.diffsExpanded.headings.h1.added} />
                    <List title="H1 removed" items={res.diffsExpanded.headings.h1.removed} />
                  </div>
                  <div>
                    <List title="H2 added" items={res.diffsExpanded.headings.h2.added} />
                    <List title="H2 removed" items={res.diffsExpanded.headings.h2.removed} />
                  </div>
                  <div>
                    <List title="H3 added" items={res.diffsExpanded.headings.h3.added} />
                    <List title="H3 removed" items={res.diffsExpanded.headings.h3.removed} />
                  </div>
                </div>
              </section>

              {/* Images missing alt */}
              <section className="p-4 rounded-lg border">
                <h3 className="font-bold text-base mb-2">Images missing alt</h3>
                <div className="text-xs text-gray-500 mb-3">
                  No-JS: {res.diffsExpanded.imagesMissingAlt.counts.noJs} · Rendered: {res.diffsExpanded.imagesMissingAlt.counts.rendered}
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <List title="New missing alt (rendered)" items={res.diffsExpanded.imagesMissingAlt.added} />
                  <List title="Fixed (missing in no-JS)" items={res.diffsExpanded.imagesMissingAlt.removed} />
                </div>
              </section>

              {/* Schema & Hreflang */}
              <section className="p-4 rounded-lg border">
                <h3 className="font-bold text-base mb-2">Schema & Hreflang</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <List title="Schema types added" items={res.diffsExpanded.schemaTypes.added} />
                    <List title="Schema types removed" items={res.diffsExpanded.schemaTypes.removed} />
                  </div>
                  <div>
                    <List title="Hreflang added" items={res.diffsExpanded.hreflang.added} />
                    <List title="Hreflang removed" items={res.diffsExpanded.hreflang.removed} />
                  </div>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
