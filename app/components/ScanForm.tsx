'use client';
import React, { useState } from 'react';

export default function ScanForm({ onResult }:{ onResult: (res:any)=>void }){
  const [url, setUrl] = useState('https://www.timesprime.com/');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/scan', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url })});
      const j = await r.json();
      if(!j.ok){ setError(j.error || 'Scan failed'); }
      else onResult(j.data);
    } catch (err:any){
      setError(String(err.message || err));
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <div className="label">URL to scan</div>
      <div className="flex gap-2">
        <input className="input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com" />
        <button className="btn" disabled={loading}>{loading ? 'Scanning...' : 'Scan'}</button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="text-xs text-gray-500">Tip: works best on publicly accessible pages. For JS-heavy sites, enable the dynamic render mode in the code.</div>
    </form>
  )
}
