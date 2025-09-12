'use client';
import React from 'react';

export default function ScorePills({ data }:{ data:any }) {
  const s = data?.score;
  if (!s) {
    // fallback: show minimal pills
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="badge">H1: {data?.h1Count ?? '—'}</span>
        <span className="badge">Links: {data?.links?.total ?? '—'}</span>
        <span className="badge">Images(no-alt): {data?.images?.missingAlt ?? 0}</span>
      </div>
    );
  }

  const Pill = ({ label, value }:{ label:string; value:number }) => (
    <div className="px-2 py-1 rounded-full border text-xs">
      <span className="font-semibold">{value}</span> <span className="opacity-70">{label}</span>
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="px-3 py-1 rounded-full border font-semibold">{s.overall}</div>
      <Pill label="Content" value={s.content} />
      <Pill label="Tech" value={s.technical} />
      <Pill label="Index" value={s.indexing} />
      <Pill label="Links" value={s.links} />
      <Pill label="Schema" value={s.structured} />
    </div>
  );
}
