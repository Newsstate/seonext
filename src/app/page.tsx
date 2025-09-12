'use client';

import React, { useState } from 'react';

type Result = {
  ok: boolean;
  data?: any;
  error?: string;
}

export default function Home() {
  const [url, setUrl] = useState('https://www.timesprime.com/');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result|null>(null);

  const onScan = async () => {
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch('/api/scan', { method: 'POST', body: JSON.stringify({ url }) });
      const j = await r.json();
      setRes(j);
    } catch (e:any) {
      setRes({ ok: false, error: String(e.message||e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Arial', padding:'24px', maxWidth: '1100px', margin:'0 auto'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1 style={{margin:0}}>SEO Insight (Next.js)</h1>
        <a href="https://vercel.com" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>Deploy on Vercel →</a>
      </header>

      <section style={{marginTop:16, padding:16, background:'#fff', borderRadius:12, boxShadow:'0 4px 20px rgba(0,0,0,.06)'}}>
        <label style={{display:'block', fontSize:14, color:'#555'}}>URL to scan</label>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com" style={{flex:1, padding:'10px 12px', borderRadius:10, border:'1px solid #ddd'}} />
          <button onClick={onScan} disabled={loading} style={{padding:'10px 16px', borderRadius:10, border:'1px solid #222', background:'#111', color:'#fff', cursor:'pointer'}}>
            {loading ? 'Scanning...' : 'Scan'}
          </button>
        </div>
      </section>

      {res && (
        <section style={{marginTop:16, padding:16, background:'#fff', borderRadius:12, boxShadow:'0 4px 20px rgba(0,0,0,.06)'}}>
          {!res.ok && <div style={{color:'#b91c1c'}}>Error: {res.error}</div>}
          {res.ok && (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
              <div>
                <h3>Basics</h3>
                <div><b>Title:</b> {res.data.title || <i>—</i>}</div>
                <div><b>Description:</b> {res.data.metaDescription || <i>—</i>}</div>
                <div><b>Canonical:</b> {res.data.canonical || <i>—</i>}</div>
                <div><b>Robots:</b> {res.data.robots || <i>—</i>}</div>
                <div><b>H1 Count:</b> {res.data.h1Count}</div>
              </div>
              <div>
                <h3>Links</h3>
                <div>Total: {res.data.links?.total}</div>
                <div>Internal: {res.data.links?.internal}</div>
                <div>External: {res.data.links?.external}</div>
                <div>Nofollow: {res.data.links?.nofollow}</div>
              </div>
              <div>
                <h3>Open Graph</h3>
                <pre style={{whiteSpace:'pre-wrap', background:'#f7f7f9', padding:8, borderRadius:8}}>{JSON.stringify(res.data.og, null, 2)}</pre>
              </div>
              <div>
                <h3>Twitter</h3>
                <pre style={{whiteSpace:'pre-wrap', background:'#f7f7f9', padding:8, borderRadius:8}}>{JSON.stringify(res.data.twitter, null, 2)}</pre>
              </div>
              <div style={{gridColumn:'1 / -1'}}>
                <h3>Schema Types</h3>
                <div>{Array.isArray(res.data.schemaTypes) && res.data.schemaTypes.length ? res.data.schemaTypes.join(', ') : <i>—</i>}</div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
