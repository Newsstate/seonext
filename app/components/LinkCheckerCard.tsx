
'use client';
import React, { useState } from 'react';

export default function LinkCheckerCard({ url }:{ url: string }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [limit, setLimit] = useState(60);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/link-check', {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body: JSON.stringify({ url, maxLinks: limit })
      });
      const j = await r.json();
      if(!j.ok) setError(j.error || 'Link check failed'); else setRes(j.data);
    } catch(e:any) { setError(String(e.message || e)); }
    finally { setLoading(false); }
  };

  const links = res?.links || [];
  const summary = res?.summary || {};

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Broken Link Checker</h3>
        <div className="flex items-center gap-2">
          <input className="input w-28" type="number" min={10} max={200} value={limit}
                 onChange={e=>setLimit(parseInt(e.target.value || '60', 10))} />
          <button className="btn" onClick={run} disabled={loading}>
            {loading ? 'Checking...' : 'Run check'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {res && (
        <>
          <div className="kv">
            <div className="k">Total</div><div className="v">{summary.total}</div>
            <div className="k">Internal</div><div className="v">{summary.internal}</div>
            <div className="k">External</div><div className="v">{summary.external}</div>
            <div className="k">Broken (≥400/error)</div><div className="v">{summary.broken}</div>
            <div className="k">Nofollow</div><div className="v">{summary.nofollow}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Nofollow</th>
                  <th className="py-2 pr-4">URL</th>
                  <th className="py-2 pr-4">Anchor</th>
                  <th className="py-2 pr-4">Final URL</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l:any, i:number)=>(
                  <tr key={i} className={(typeof l.status==='number' && l.status >= 400) || l.error ? 'text-red-700' : ''}>
                    <td className="py-1 pr-4">{l.status ?? (l.error ? 'ERR' : '—')}</td>
                    <td className="py-1 pr-4">{l.internal ? 'Internal' : 'External'}</td>
                    <td className="py-1 pr-4">{l.relNofollow ? 'Yes' : 'No'}</td>
                    <td className="py-1 pr-4 break-all">{l.url}</td>
                    <td className="py-1 pr-4">{l.text || '—'}</td>
                    <td className="py-1 pr-4 break-all">{l.finalUrl || '—'}</td>
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
