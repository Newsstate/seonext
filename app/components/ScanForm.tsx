'use client';

import React, { useState } from 'react';

type ControlledProps = {
  /** legacy/controlled mode (parent owns url + submit) */
  url: string;
  setUrl: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

type SelfManagedProps = {
  /** self-managed mode (component fetches /api/scan and returns result) */
  onResult: (data: any) => void;
  defaultUrl?: string;
};

type Props = ControlledProps | SelfManagedProps;

export default function ScanForm(props: Props) {
  const isSelfManaged = (p: Props): p is SelfManagedProps => (p as any).onResult !== undefined;

  // shared UI bits
  const [renderJs, setRenderJs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // --- SELF-MANAGED MODE -----------------------------------------------------
  if (isSelfManaged(props)) {
    const [url, setUrl] = useState(props.defaultUrl || '');

    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!url) return;
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url, render: renderJs })
        });
        const j = await r.json();
        if (!j.ok) setErr(j.error || 'Scan failed');
        else props.onResult(j.data);
      } catch (e: any) {
        setErr(String(e.message || e));
      } finally {
        setLoading(false);
      }
    };

    return (
      <form onSubmit={submit} className="card p-5 space-y-3">
        <label className="text-sm text-[rgb(var(--muted))]">URL to scan</label>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="https://example.com/page"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Scanning…' : 'Scan'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={renderJs}
              onChange={(e) => setRenderJs(e.target.checked)}
            />
            Render JS (if enabled server-side)
          </label>
          <span className="ml-auto">
            Tip: works best on publicly accessible pages.
          </span>
        </div>

        {err && <div className="text-xs text-red-600">{err}</div>}
      </form>
    );
  }

  // --- CONTROLLED/LEGACY MODE ------------------------------------------------
  const { url, setUrl, onSubmit } = props as ControlledProps;
  return (
    <form onSubmit={onSubmit} className="card p-5 space-y-3">
      <label className="text-sm text-[rgb(var(--muted))]">URL to scan</label>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="https://example.com/page"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn" type="submit" disabled={loading}>
          Scan
        </button>
      </div>
      {err && <div className="text-xs text-red-600">{err}</div>}
      <p className="text-xs text-[rgb(var(--muted))]">
        Tip: works best on publicly accessible pages.
      </p>
    </form>
  );
}
