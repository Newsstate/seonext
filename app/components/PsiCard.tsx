'use client';
import React, { useState } from 'react';

export default function PsiCard({ url }:{ url:string }){
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any|null>(null);
  const [error, setError] = useState<string|null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    const r = await fetch('/api/psi', {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body: JSON.stringify({ url, strategy: 'mobile' })
    });
    const j = await r.json();
    if(!j.ok) setError(j.error || 'PSI failed'); else setData(j.data);
    setLoading(false);
  };

  const lcp = data?.lighthouseResult?.audits?.['largest-contentful-paint']?.numericValue;
  const cls = data?.lighthouseResult?.audits?.['cumulative-layout-shift']?.numericValue;
  const tti = data?.lighthouseResult?.audits?.['interactive']?.numericValue;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">PageSpeed Insights</h3>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? 'Running...' : 'Run PSI (mobile)'}
        </button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {data && (
        <div className="grid md:grid-cols-3 gap-6 text-sm">
          <div><div className="text-gray-500">LCP</div><div className="text-lg font-semibold">{lcp ? (lcp/1000).toFixed(2)+'s' : '—'}</div></div>
          <div><div className="text-gray-500">CLS</div><div className="text-lg font-semibold">{typeof cls==='number' ? cls.toFixed(3) : '—'}</div></div>
          <div><div className="text-gray-500">TTI</div><div className="text-lg font-semibold">{tti ? (tti/1000).toFixed(2)+'s' : '—'}</div></div>
        </div>
      )}
      <div className="text-xs text-gray-500">Requires <code>PAGESPEED_API_KEY</code> env var.</div>
    </div>
  );
}
