'use client';
import React, { useState } from 'react';

export default function SitemapCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [limit, setLimit] = useState(100);
  const [scanning, setScanning] = useState(false);
  const [scanRes, setScanRes] = useState<any[]>([]);

  const discover = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/sitemap', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ url, limit })
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || 'Failed'); else setRes(j.data);
    } catch(e:any) { setError(String(e.message||e)); }
    finally { setLoading(false); }
  };

  // light client-side scan using existing /api/scan
  const quickScan = async (n=10) => {
    if (!res?.urls?.length) return;
    setScanning(true); setScanRes([]);
    const pick = res.urls.slice(0, n);
    const out:any[] = [];
    for (const item of pick) {
      try {
        const r = await fetch('/api/scan', {
          method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ url: item.loc })
        });
        const j = await r.json();
        if (j.ok) out.push({ url: item.loc, score: j.data?.score?.overall ?? null, noindex: !!j.data?.robotsMeta?.noindex, status: j.data?.http?.status });
        else out.push({ url: item.loc, error: j.error || 'scan failed' });
      } catch(e:any) {
        out.push({ url: item.loc, error: String(e.message||e) });
      }
      setScanRes([...out]); // progressive update
    }
    setScanning(false);
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Sitemap</h3>
        <div className="flex items-center gap-2">
          <input className="input w-28" type="number" min={20} max={500} value={limit}
                 onChange={e=>setLimit(parseInt(e.target.value||'100',10))} />
          <button className="btn" onClick={discover} disabled={loading}>{loading ? 'Discovering…' : 'Discover'}</button>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {res && (
        <>
          <div className="kv">
            <div className="k">Origin</div><div className="v">{res.origin}</div>
            <div className="k">Sitemaps</div><div className="v">{(res.sitemaps||[]).join(', ')}</div>
            <div className="k">URLs (first {res.count})</div><div className="v">{res.count}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={()=>quickScan(10)} disabled={scanning || !res.urls?.length}>
              {scanning ? 'Scanning…' : 'Quick scan 10'}
            </button>
            <button className="btn-ghost" onClick={()=>quickScan(25)} disabled={scanning || !res.urls?.length}>
              {scanning ? 'Scanning…' : 'Quick scan 25'}
            </button>
          </div>

          {!!scanRes.length && (
            <div className="overflow-x-auto">
              <table className="table-pro">
                <thead><tr>
                  <th className="th-pro">Status</th>
                  <th className="th-pro">Score</th>
                  <th className="th-pro">Noindex</th>
                  <th className="th-pro">URL</th>
                </tr></thead>
                <tbody>
                  {scanRes.map((r,i)=>(
                    <tr key={i} className={r.error || (r.status>=400) ? 'text-red-700' : ''}>
                      <td className="td-pro">{r.error ? 'ERR' : (r.status ?? '—')}</td>
                      <td className="td-pro">{r.score ?? '—'}</td>
                      <td className="td-pro">{r.noindex ? 'Yes' : 'No'}</td>
                      <td className="td-pro break-all">{r.url}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
