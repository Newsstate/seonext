'use client';
import React from 'react';

export default function ScanForm({ url, setUrl, onSubmit }:{
  url: string; setUrl: (v:string)=>void; onSubmit: (e:React.FormEvent)=>void;
}) {
  return (
    <form onSubmit={onSubmit} className="card p-5 space-y-3">
      <label className="text-sm text-[rgb(var(--muted))]">URL to scan</label>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="https://example.com/page"
          value={url}
          onChange={e=>setUrl(e.target.value)}
        />
        <button className="btn" type="submit">Scan</button>
      </div>
      <p className="text-xs text-[rgb(var(--muted))]">
        Tip: works best on publicly accessible pages. For JS-heavy sites, enable the dynamic render mode in code.
      </p>
    </form>
  );
}
