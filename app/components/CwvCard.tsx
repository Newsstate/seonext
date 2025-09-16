'use client';
import React, { useState } from 'react';

type Metric = { percentile: number; category: 'FAST' | 'AVERAGE' | 'SLOW' | string };
type Payload = {
  mobile: { strategy: 'mobile'; loadingExperience: Record<string, Metric>; lighthousePerfScore: number | null; };
  desktop: { strategy: 'desktop'; loadingExperience: Record<string, Metric>; lighthousePerfScore: number | null; };
};

function badgeClass(cat?: string) {
  if (cat === 'FAST') return 'bg-green-100 text-green-800';
  if (cat === 'AVERAGE') return 'bg-amber-100 text-amber-800';
  if (cat === 'SLOW') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

export default function CwvCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [data, setData] = useState<Payload|null>(null);
  const [mode, setMode] = useState<'mobile'|'desktop'>('mobile');

  const run = async () => {
    setLoading(true); setErr(null); setData(null);
    try {
      const r = await fetch('/api/cwv', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setData(j.data);
    } catch (e:any) {
      setErr(String(e.message||e));
    } finally {
      setLoading(false);
    }
  };

  const cur = data?.[mode];

  const formatLcp = (ms?: number) => (ms == null ? '—' : `${(ms/1000).toFixed(2)}s`);
  const formatInp = (ms?: number) => (ms == null ? '—' : `${Math.round(ms)} ms`);
  const formatCls = (v?: number) => (v == null ? '—' : v.toFixed(2));

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Core Web Vitals (CrUX)</h3>
        <div className="flex items-center gap-2">
          <select className="input" value={mode} onChange={e=>setMode(e.target.value as any)}>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>
          <button className="btn" onClick={run} disabled={loading || !url}>
            {loading ? 'Fetching…' : 'Fetch'}
          </button>
        </div>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {cur && (
        <div className="kv">
          <div className="k">LCP (p75)</div>
          <div className="v">
            {formatLcp(cur.loadingExperience['LARGEST_CONTENTFUL_PAINT_MS']?.percentile)}
            <span className={`badge ml-2 ${badgeClass(cur.loadingExperience['LARGEST_CONTENTFUL_PAINT_MS']?.category)}`}>
              {cur.loadingExperience['LARGEST_CONTENTFUL_PAINT_MS']?.category || '—'}
            </span>
          </div>

          <div className="k">INP (p75)</div>
          <div className="v">
            {formatInp(cur.loadingExperience['INTERACTION_TO_NEXT_PAINT']?.percentile)}
            <span className={`badge ml-2 ${badgeClass(cur.loadingExperience['INTERACTION_TO_NEXT_PAINT']?.category)}`}>
              {cur.loadingExperience['INTERACTION_TO_NEXT_PAINT']?.category || '—'}
            </span>
          </div>

          <div className="k">CLS (p75)</div>
          <div className="v">
            {formatCls(cur.loadingExperience['CUMULATIVE_LAYOUT_SHIFT_SCORE']?.percentile)}
            <span className={`badge ml-2 ${badgeClass(cur.loadingExperience['CUMULATIVE_LAYOUT_SHIFT_SCORE']?.category)}`}>
              {cur.loadingExperience['CUMULATIVE_LAYOUT_SHIFT_SCORE']?.category || '—'}
            </span>
          </div>

          <div className="k">Lighthouse (lab)</div>
          <div className="v">{cur.lighthousePerfScore != null ? Math.round(cur.lighthousePerfScore * 100) : '—'}</div>
        </div>
      )}
    </div>
  );
}
