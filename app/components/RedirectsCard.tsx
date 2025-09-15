'use client';
import React, { useState } from 'react';

export default function RedirectsCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any|null>(null);
  const [err, setErr] = useState<string|null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/redirects', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setData(j.data);
    } catch(e:any) { setErr(String(e.message||e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Redirect Chain</h3>
        <button className="btn" onClick={run} disabled={loading}>{loading ? 'Checking…' : 'Check'}</button>
      </div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {data && (
        <div className="overflow-x-auto">
          <table className="table-pro">
            <thead>
              <tr>
                <th className="th-pro">Status</th>
                <th className="th-pro">Location</th>
                <th className="th-pro">URL</th>
              </tr>
            </thead>
            <tbody>
              {data.chain.map((h:any, i:number)=>(
                <tr key={i} className={(h.status >= 300 && h.status < 400) ? '' : (h.status >= 400 || h.error ? 'text-red-700' : '')}>
                  <td className="td-pro">{h.error ? 'ERR' : (h.status ?? '—')}</td>
                  <td className="td-pro break-all">{h.location || '—'}</td>
                  <td className="td-pro break-all">{h.url}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
