// app/components/IndexingCard.tsx
'use client';
import React, { useState } from 'react';

export default function IndexingCard({ url }:{ url:string }){
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any|null>(null);
  const [error, setError] = useState<string|null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/indexing', { method:'POST', body: JSON.stringify({ url }) });
      const j = await r.json();
      if(!j.ok) setError(j.error || 'Indexing audit failed');
      else setData(j.data);
    } catch (e:any) {
      setError(String(e.message||e));
    } finally { setLoading(false); }
  };

  const robots = data?.robots;
  const sitemaps = data?.sitemaps;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Indexing (robots.txt & sitemaps)</h3>
        <button className="btn" onClick={run} disabled={loading}>{loading ? 'Checking...' : 'Run audit'}</button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}

      {data && (
        <div className="space-y-6 text-sm">
          <section>
            <div className="text-gray-500 mb-1">Origin</div>
            <div className="font-medium">{data.origin}</div>
          </section>

          <section>
            <h4 className="font-semibold mb-2">robots.txt</h4>
            <div className="kv">
              <div className="k">Found</div><div className="v">{robots?.found ? 'Yes' : 'No'}</div>
              <div className="k">Status</div><div className="v">{robots?.status ?? '—'}</div>
              <div className="k">Crawl-delay</div><div className="v">{robots?.crawlDelay ?? '—'}</div>
              <div className="k">Allows</div><div className="v">{(robots?.allow||[]).slice(0,5).join(', ') || '—'}</div>
              <div className="k">Disallows</div><div className="v">{(robots?.disallow||[]).slice(0,5).join(', ') || '—'}</div>
              <div className="k">Sitemaps</div><div className="v">{(robots?.sitemaps||[]).join(', ') || '—'}</div>
            </div>
          </section>

          <section>
            <h4 className="font-semibold mb-2">Sitemaps</h4>
            <div className="kv">
              <div className="k">Found</div><div className="v">{sitemaps?.found ? 'Yes' : 'No'}</div>
              <div className="k">Checked</div><div className="v">{sitemaps?.checkedCount ?? 0}</div>
              <div className="k">Total URLs (sampled)</div><div className="v">{sitemaps?.totalUrls ?? 0}</div>
              <div className="k">Page in sitemap?</div><div className="v">{sitemaps?.foundPageInSitemap ? 'Yes' : 'No'}</div>
            </div>
            <div className="mt-2">
              {(sitemaps?.list||[]).map((s:any, i:number)=> (
                <div key={i} className="text-xs text-gray-700">• {s.type.toUpperCase()} — {s.url} {typeof s.count==='number' ? `(count: ${s.count})` : ''}</div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
