'use client';
import React, { useState } from 'react';

function ttlFmt(s?: number|null) {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.round(s/60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m/60);
  if (h < 48) return `${h}h`;
  const d = Math.round(h/24);
  return `${d}d`;
}

export default function HeadersCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any|null>(null);
  const [err, setErr] = useState<string|null>(null);

  const run = async () => {
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/headers', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setRes(j.data);
    } catch(e:any) { setErr(String(e.message||e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Headers & Caching</h3>
        <button className="btn" onClick={run} disabled={loading || !url}>
          {loading ? 'Checking…' : 'Check'}
        </button>
      </div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {res && (
        <>
          <div className="kv">
            <div className="k">Status</div><div className="v">{res.status}</div>
            <div className="k">Final URL</div><div className="v break-all">{res.finalUrl}</div>
            <div className="k">Content-Type</div><div className="v">{res.contentType || '—'}</div>
            <div className="k">Cache-Control</div><div className="v">{res.cacheControl || '—'}</div>
            <div className="k">Max-Age</div><div className="v">{ttlFmt(res.maxAge)}</div>
            <div className="k">Content-Encoding</div><div className="v">{res.contentEncoding || '—'}</div>
            <div className="k">Compressed</div><div className="v">{res.compressed ? 'Yes' : 'No'}</div>
            <div className="k">Vary</div><div className="v">{res.vary || '—'}</div>
            <div className="k">ETag</div><div className="v">{res.etag || '—'}</div>
            <div className="k">Last-Modified</div><div className="v">{res.lastModified || '—'}</div>
            <div className="k">Server</div><div className="v">{res.server || '—'}</div>
            <div className="k">X-Powered-By</div><div className="v">{res.xPoweredBy || '—'}</div>
          </div>

          {res.notes?.length > 0 && (
            <div className="mt-2">
              <h4 className="font-semibold mb-2">Notes</h4>
              <ul className="list-disc pl-6 text-sm">
                {res.notes.map((n:string, i:number)=>(<li key={i} className="text-amber-700">⚠️ {n}</li>))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
