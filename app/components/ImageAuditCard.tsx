'use client';
import React, { useState } from 'react';

function fmtKB(b?: number|null) {
  if (!b && b !== 0) return '—';
  return `${Math.round(b/1024).toLocaleString()} KB`;
}

export default function ImageAuditCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [limit, setLimit] = useState(30);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/images', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ url, limit })
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setRes(j.data);
    } catch(e:any) { setErr(String(e.message||e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Image Weight Audit</h3>
        <div className="flex items-center gap-2">
          <input className="input w-28" type="number" min={10} max={100} value={limit}
                 onChange={e=>setLimit(parseInt(e.target.value||'30',10))} />
          <button className="btn" onClick={run} disabled={loading}>
            {loading ? 'Auditing…' : 'Audit'}
          </button>
        </div>
      </div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {res && (
        <>
          <div className="kv">
            <div className="k">Images checked</div><div className="v">{res.count}</div>
            <div className="k">Total weight</div><div className="v">{fmtKB(res.totalBytes)}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th className="th-pro">Status</th>
                  <th className="th-pro">Size</th>
                  <th className="th-pro">Type</th>
                  <th className="th-pro">Next-gen?</th>
                  <th className="th-pro">Alt</th>
                  <th className="th-pro">WxH</th>
                  <th className="th-pro">URL</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.map((r:any, i:number)=>(
                  <tr key={i} className={(r.bytes>200*1024 || r.status>=400 || r.error) ? 'text-amber-700' : ''}>
                    <td className="td-pro">{r.error ? 'ERR' : (r.status ?? '—')}</td>
                    <td className="td-pro">{fmtKB(r.bytes)}</td>
                    <td className="td-pro">{r.type || '—'}</td>
                    <td className="td-pro">{r.suggestedNextGen ? 'Consider' : 'OK'}</td>
                    <td className="td-pro">{r.altMissing ? 'Missing' : 'OK'}</td>
                    <td className="td-pro">{(r.width && r.height) ? `${r.width}×${r.height}` : '—'}</td>
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
