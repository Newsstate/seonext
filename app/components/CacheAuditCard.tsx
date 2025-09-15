'use client';
import React, { useState } from 'react';

function fmtKB(b?: number|null) {
  if (!b && b !== 0) return '—';
  return `${Math.round(b/1024).toLocaleString()} KB`;
}
function fmtAge(s?: number|null) {
  if (s == null) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400)/3600);
  return d ? `${d}d ${h}h` : `${h}h`;
}

export default function CacheAuditCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [limit, setLimit] = useState(60);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/cache', {
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
        <h3 className="font-semibold">Static Assets Cache Audit</h3>
        <div className="flex items-center gap-2">
          <input className="input w-24" type="number" min={20} max={200} value={limit}
                 onChange={e=>setLimit(parseInt(e.target.value||'60',10))}/>
          <button className="btn" onClick={run} disabled={loading || !url}>
            {loading ? 'Auditing…' : 'Audit'}
          </button>
        </div>
      </div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {res && (
        <>
          <div className="kv">
            <div className="k">Assets checked</div><div className="v">{res.count}</div>
            <div className="k">Total weight</div><div className="v">{fmtKB(res.totalBytes)}</div>
            <div className="k">TTL &lt; 1 day</div><div className="v">{res.lowTtlCount}</div>
            <div className="k">By type</div><div className="v">img {res.byType.images} · js {res.byType.js} · css {res.byType.css}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th className="th-pro">Status</th>
                  <th className="th-pro">Size</th>
                  <th className="th-pro">Type</th>
                  <th className="th-pro">max-age</th>
                  <th className="th-pro">Cache-Control</th>
                  <th className="th-pro">URL</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.map((r:any,i:number)=>(
                  <tr key={i} className={((r.maxAge??0) < 86400 || r.status>=400 || r.error) ? 'text-amber-700' : ''}>
                    <td className="td-pro">{r.error ? 'ERR' : (r.status ?? '—')}</td>
                    <td className="td-pro">{fmtKB(r.bytes)}</td>
                    <td className="td-pro">{r.type || '—'}</td>
                    <td className="td-pro">{fmtAge(r.maxAge)}</td>
                    <td className="td-pro break-all">{r.cacheControl || '—'}</td>
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
