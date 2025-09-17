'use client';
import React from 'react';

type Status = 'pending' | 'active' | 'done' | 'error';

const STEPS = [
  { key: 'overview',    label: 'Overview' },
  { key: 'content',     label: 'Content' },
  { key: 'headings',    label: 'Headings' },
  { key: 'images',      label: 'Images' },
  { key: 'links',       label: 'Links' },
  { key: 'meta',        label: 'Meta' },
  { key: 'openGraph',   label: 'Open Graph' },
  { key: 'twitter',     label: 'Twitter' },
  { key: 'canonical',   label: 'Canonical' },
  { key: 'hreflang',    label: 'Hreflang' },
  { key: 'robots',      label: 'Robots' },
  { key: 'sitemap',     label: 'Sitemap' },
  { key: 'amp',         label: 'AMP' },
  { key: 'performance', label: 'Performance' },
  { key: 'security',    label: 'Security' },
  { key: 'structured',  label: 'Structured Data' },
  { key: 'scoring',     label: 'Scoring' },
] as const;

export function ScanProgress({
  state,
  percent,
  substep,
}: {
  state: Record<string, Status>;
  percent: number;
  substep?: string | null;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto px-4 py-3">
        {/* bar */}
        <div className="flex items-center gap-3">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#3b82f6' }} />
          </div>
          <span className="text-sm tabular-nums">{pct}%</span>
        </div>

        {/* pills */}
        <div className="flex flex-wrap gap-2 mt-2">
          {STEPS.map((s) => {
            const st: Status = state[s.key] ?? 'pending';
            const cls =
              st === 'done' ? 'bg-green-500 text-white' :
              st === 'active' ? 'bg-blue-500 text-white animate-pulse' :
              st === 'error' ? 'bg-red-500 text-white' :
              'bg-gray-200 text-gray-700';
            return (
              <span key={s.key} className={`px-2 py-1 text-xs rounded-full font-medium ${cls}`}>
                {s.label}
              </span>
            );
          })}
        </div>

        {/* substep */}
        {substep ? <div className="mt-2 text-xs text-gray-600">{substep}</div> : null}
      </div>
    </div>
  );
}
