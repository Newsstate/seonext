'use client';

import React, { useState } from 'react';
import { ScanProgress } from './ScanProgress';

type ControlledProps = { url: string; setUrl: (v: string) => void; onSubmit: (e: React.FormEvent) => void; };
type SelfManagedProps = { onResult: (data: any) => void; defaultUrl?: string; };
type Props = ControlledProps | SelfManagedProps;
type Status = 'pending' | 'active' | 'done' | 'error';

const ORDER = [
  'overview','content','headings','images','links','meta','openGraph','twitter',
  'canonical','hreflang','robots','sitemap','amp','performance','security','structured','scoring'
];

export default function ScanForm(props: Props) {
  const controlled = 'onSubmit' in props;
  const [url, setUrl] = useState(controlled ? (props as ControlledProps).url : (props as SelfManagedProps).defaultUrl || '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [percent, setPercent] = useState(0);
  const [steps, setSteps] = useState<Record<string, Status>>({});
  const [substep, setSubstep] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (controlled) return (props as ControlledProps).onSubmit(e);

    try {
      setLoading(true);
      setPercent(0);
      setSteps({});
      setSubstep(null);

      const es = new EventSource(`/api/scan/stream?${new URLSearchParams({ url }).toString()}`);

      es.onmessage = (ev) => {
        const data = JSON.parse(ev.data || '{}');

        if (typeof data.percent === 'number') setPercent(data.percent);
        setSubstep(data.substep || null);

        if (data.step) {
          setSteps(prev => {
            const next = { ...prev };
            next[data.step] = data.done ? 'done' : 'active';
            for (const k of ORDER) {
              if (k === data.step) break;
              next[k] = 'done';
            }
            return next;
          });
        }

        if (data.status === 'done') {
          es.close();
          setLoading(false);
          setPercent(100);
          setSubstep(null);
          (props as SelfManagedProps).onResult?.(data.data);
        }
        if (data.status === 'error') {
          es.close();
          setLoading(false);
          setSubstep(null);
          setErr(data.message || 'Scan failed');
        }
      };

      es.onerror = () => {
        es.close();
        setLoading(false);
        setSubstep(null);
        setErr('Connection lost while streaming progress.');
      };
    } catch (e: any) {
      setErr(String(e?.message || e));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      {loading && <ScanProgress state={steps} percent={percent} substep={substep} />}

      <label className="text-sm text-[rgb(var(--muted))]">URL to scan</label>
      <div className="flex gap-2">
        <input className="input" placeholder="https://example.com/page" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Scanning…' : 'Scan'}</button>
      </div>

      {err && <div className="text-xs text-red-600">{err}</div>}
    </form>
  );
}
