'use client';
import React, { useState } from 'react';

export default function CanonicalizeCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]|null>(null);
  const [err, setErr] = useState<string|null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/canonicalize', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setRows(j.data);
    } catch(e:any) { setErr(String(e.message||e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Canonicalization (protocol + www)</h3>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? 'Testing…' : 'Test'}
        </button>
      </div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {rows && (
        <div className="overflow-x-auto">
          <table className="table-pro">
            <thead><tr>
              <th className="th-pro">Variant</th>
              <th className="th-pro">Status</th>
              <th className="th-pro">Final URL</th>
            </tr></thead>
            <tbody>
              {rows.map((r:any, i:number)=>(
                <tr key={i} className={(r.status>=300 && r.status<400) ? '' : (r.status>=400 || r.error ? 'text-red-700' : '')}>
                  <td className="td-pro break-all">{r.input}</td>
                  <td className="td-pro">{r.error ? 'ERR' : (r.status ?? '—')}</td>
                  <td className="td-pro break-all">{r.finalUrl || r.error || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
