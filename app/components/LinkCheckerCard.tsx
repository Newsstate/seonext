'use client';
import React, { useState } from 'react';

export default function LinkCheckerCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [limit, setLimit] = useState(150);

  const run = async () => {
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/links', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ url, limit })
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setRes(j.data);
    } catch(e:any) { setErr(String(e.message||e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">On-page Link Checker</h3>
        <div className="flex items-center gap-2">
          <input className="input w-24" type="number" min={50} max={400} value={limit}
                 onChange={e=>setLimit(parseInt(e.target.value||'150',10))}/>
          <button className="btn" onClick={run} disabled={loading || !url}>
            {loading ? 'Checking…' : 'Check'}
          </button>
        </div>
      </div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {res && (
        <div className="overflow-x-auto">
          <table className="table-pro">
            <thead>
              <tr>
                <th className="th-pro">Status</th>
                <th className="th-pro">Internal</th>
                <th className="th-pro">Nofollow</th>
                <th className="th-pro">_blank unsafe</th>
                <th className="th-pro">Anchor</th>
                <th className="th-pro">URL</th>
              </tr>
            </thead>
            <tbody>
              {res.rows.map((r:any, i:number)=>(
                <tr key={i} className={(r.status>=400 || r.error) ? 'text-red-700' : ''}>
                  <td className="td-pro">{r.error ? 'ERR' : (r.status ?? '—')}</td>
                  <td className="td-pro">{r.internal ? 'Yes' : 'No'}</td>
                  <td className="td-pro">{r.nofollow ? 'Yes' : 'No'}</td>
                  <td className="td-pro">{r.targetBlankUnsafe ? 'Yes' : 'No'}</td>
                  <td className="td-pro">{r.text || '—'}</td>
                  <td className="td-pro break-all">{r.url}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
