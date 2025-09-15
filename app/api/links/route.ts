'use client';
import React, { useState } from 'react';

type Scope = 'all'|'internal'|'external';

export default function LinkCheckerCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<Scope>('all');
  const [limit, setLimit] = useState(60);
  const [data, setData] = useState<any|null>(null);
  const [err, setErr] = useState<string|null>(null);

  const run = async () => {
    setLoading(true); setErr(null); setData(null);
    try {
      const r = await fetch('/api/links', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ url, limit, scope })
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setData(j.data);
    } catch(e:any) { setErr(String(e.message||e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Link Checker</h3>
        <div className="flex items-center gap-2">
          <select className="input" value={scope} onChange={e=>setScope(e.target.value as Scope)}>
            <option value="all">All</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
          <input className="input w-24" type="number" min={10} max={200} value={limit}
                 onChange={e=>setLimit(parseInt(e.target.value||'60',10))} />
          <button className="btn" onClick={run} disabled={loading || !url}>
            {loading ? 'Checking…' : 'Run'}
          </button>
        </div>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {data && (
        <>
          <div className="kv">
            <div className="k">Links on page</div><div className="v">{data.counts.totalOnPage}</div>
            <div className="k">Checked</div><div className="v">{data.counts.checked}</div>
            <div className="k">Internal / External</div><div className="v">{data.counts.internal} / {data.counts.external}</div>
            <div className="k">Errors (4xx/5xx)</div><div className="v">{data.counts.errors}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th className="th-pro">Status</th>
                  <th className="th-pro">Type</th>
                  <th className="th-pro">rel</th>
                  <th className="th-pro">target</th>
                  <th className="th-pro">Security</th>
                  <th className="th-pro">URL</th>
                  <th className="th-pro">Anchor</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r:any, i:number)=>(
                  <tr key={i} className={(r.status>=400 || r.error || r.security==='noopener-missing') ? 'text-amber-700' : ''}>
                    <td className="td-pro">{r.error ? 'ERR' : (r.status ?? '—')}</td>
                    <td className="td-pro">{r.type}</td>
                    <td className="td-pro">{[r.nofollow?'nofollow':'', r.ugc?'ugc':'', r.sponsored?'sponsored':''].filter(Boolean).join(', ') || '—'}</td>
                    <td className="td-pro">{r.target || '—'}</td>
                    <td className="td-pro">{r.security==='noopener-missing' ? 'noopener missing' : 'ok'}</td>
                    <td className="td-pro break-all">{r.finalUrl || r.url}</td>
                    <td className="td-pro">{r.text || '—'}</td>
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
