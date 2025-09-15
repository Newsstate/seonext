'use client';
import React, { useState } from 'react';

export default function RobotsCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any|null>(null);
  const [err, setErr] = useState<string|null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/robots', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setRes(j.data);
    } catch(e:any) { setErr(String(e.message||e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">robots.txt</h3>
        <button className="btn" onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Load'}</button>
      </div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {res && (
        <>
          <div className="kv">
            <div className="k">URL</div><div className="v">{res.robotsUrl}</div>
            <div className="k">Sitemaps</div><div className="v">{(res.sitemaps||[]).join(', ') || <i>—</i>}</div>
          </div>
          <div className="space-y-2">
            {res.groups?.map((g:any, i:number)=>(
              <div key={i} className="rounded-lg border p-3">
                <div className="text-sm font-semibold">User-agent: {g.agent}</div>
                <div className="mt-1 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-gray-500 mb-1">Allow</div>
                    <ul className="list-disc pl-5 space-y-0.5">{g.allow.map((a:string, idx:number)=>(<li key={idx}>{a || '/'}</li>))}</ul>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Disallow</div>
                    <ul className="list-disc pl-5 space-y-0.5">{g.disallow.map((d:string, idx:number)=>(<li key={idx}>{d || '/'}</li>))}</ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer">Raw robots.txt</summary>
            <pre className="code mt-2">{res.raw || '(empty or 4xx)'}</pre>
          </details>
        </>
      )}
    </div>
  );
}
