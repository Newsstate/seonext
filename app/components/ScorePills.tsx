'use client';
import React from 'react';

export default function ScorePills({ data }:{ data:any }) {
  const s = data?.score;
  const Pill = ({ label, value }:{ label:string; value:number|string }) => (
    <div className="px-2.5 py-1 rounded-full border border-[rgb(var(--border))] text-xs">
      <span className="font-semibold">{value}</span> <span className="text-[rgb(var(--muted))]">{label}</span>
    </div>
  );

  if (!s) {
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        <Pill label="H1" value={data?.h1Count ?? '—'} />
        <Pill label="Links" value={data?.links?.total ?? '—'} />
        <Pill label="Alt missing" value={data?.images?.missingAlt ?? 0} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="px-3 py-1 rounded-full bg-[rgb(var(--brand))] text-white font-semibold">{s.overall}</div>
      <Pill label="Content" value={s.content} />
      <Pill label="Tech" value={s.technical} />
      <Pill label="Index" value={s.indexing} />
      <Pill label="Links" value={s.links} />
      <Pill label="Schema" value={s.structured} />
    </div>
  );
}
