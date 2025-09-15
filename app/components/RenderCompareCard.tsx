'use client';
import React, { useState } from 'react';

type DiffRow = { key: string; a: any; b: any; same: boolean };

export default function RenderCompareCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [res, setRes] = useState<null | {
    noJs: { url:string; status:number|null; domSize:number; words:number; };
    rendered: { url:string; status:number|null; domSize:number; words:number; };
    summary: { textSimilarity:number; domDelta:number; wordsDelta:number; keyChangesCount:number; };
    diffs: DiffRow[];
  }>(null);

  const [waitUntil, setWaitUntil] = useState<'domcontentloaded'|'networkidle0'|'load'>('networkidle0');

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

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Render vs No-JS Diff</h3>
        <div className="flex items-center gap-2">
          <select className="input" value={waitUntil} onChange={e=>setWaitUntil(e.target.value as any)}>
            <option value="domcontentloaded">domcontentloaded</option>
            <option value="load">load</option>
            <option value="networkidle0">networkidle0</option>
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
        </>
      )}
    </div>
  );
}
