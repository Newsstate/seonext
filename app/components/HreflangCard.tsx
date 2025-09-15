'use client';
import React, { useState } from 'react';

export default function HreflangCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any|null>(null);
  const [err, setErr] = useState<string|null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/hreflang', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url, limit: 10 }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setData(j.data);
    } catch(e:any) { setErr(String(e.message||e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Hreflang reciprocity</h3>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? 'Checking…' : 'Run check'}
        </button>
      </div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {data && (
        <>
          <div className="kv">
            <div className="k">Source</div><div className="v">{data.source}</div>
            <div className="k">Alternates</div><div className="v">{data.total}</div>
            <div className="k">Checked</div><div className="v">{data.checked}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th className="th-pro">Lang</th>
                  <th className="th-pro">Status</th>
                  <th className="th-pro">Reciprocal?</th>
                  <th className="th-pro">URL</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r:any, i:number)=>(
                  <tr key={i} className={r.reciprocal ? '' : 'text-amber-700'}>
                    <td className="td-pro">{r.lang}</td>
                    <td className="td-pro">{r.error ? 'ERR' : (r.status ?? '—')}</td>
                    <td className="td-pro">{r.reciprocal ? 'Yes' : (r.error ? '—' : 'No')}</td>
                    <td className="td-pro break-all">{r.url}</td>
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
