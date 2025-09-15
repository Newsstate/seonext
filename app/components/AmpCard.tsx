'use client';
import React, { useState } from 'react';

export default function AmpCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any|null>(null);
  const [err, setErr] = useState<string|null>(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/amp', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setRes(j.data);
    } catch (e:any) {
      setErr(String(e.message||e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">AMP</h3>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? 'Checking…' : 'Check'}
        </button>
      </div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {res && (
        <>
          {!res.hasAmp ? (
            <div className="text-sm">No <code>amphtml</code> link found on the page.</div>
          ) : (
            <div className="kv">
              <div className="k">URL</div><div className="v">{res.ampUrl}</div>
              <div className="k">Status</div><div className="v">{res.status}</div>
              <div className="k">`<html amp>` present</div><div className="v">{res.validHtmlFlag ? 'Yes' : 'No'}</div>
              <div className="k">Canonical back-link</div><div className="v">{res.hasCanonicalBack ? 'Yes' : 'No'}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
