'use client';
import React, { useState } from 'react';

type Finding = { type: string; detail: string; sample?: string };

export default function CrawlHintsCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [res, setRes] = useState<{ url:string; findings: Finding[]; recommends: string[] }|null>(null);

  const run = async () => {
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/crawl-hints', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setRes(j.data);
    } catch (e:any) {
      setErr(String(e.message||e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Crawl-Budget Hints</h3>
        <button className="btn" onClick={run} disabled={loading || !url}>
          {loading ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {res && (
        <>
          <div className="kv">
            <div className="k">Scanned URL</div><div className="v break-all">{res.url}</div>
          </div>

          {!!res.findings.length && (
            <div>
              <h4 className="font-medium mb-2">Findings</h4>
              <ul className="list-disc pl-6 space-y-1">
                {res.findings.map((f, i)=>(
                  <li key={i}>
                    <span className="font-medium">{f.type}:</span> {f.detail}
                    {f.sample && <span className="text-gray-500"> — {f.sample}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!!res.recommends.length && (
            <div>
              <h4 className="font-medium mb-2">Recommendations</h4>
              <ul className="list-disc pl-6 space-y-1">
                {res.recommends.map((r, i)=>(
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
