'use client';
import React, { useState } from 'react';

type AmpResult =
  | { hasAmp: false }
  | {
      hasAmp: true;
      ampUrl: string;
      status: number;
      validHtmlFlag: boolean;     // <html amp> or ⚡ present
      hasCanonicalBack: boolean;  // rel="canonical" exists (see API notes)
    };

export default function AmpCard({ url }: { url: string }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<AmpResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      const r = await fetch('/api/amp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed');
      else setRes(j.data as AmpResult);
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const Badge = ({ ok }: { ok: boolean }) => (
    <span className={`badge ${ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'} ml-2`}>
      {ok ? 'Yes' : 'No'}
    </span>
  );

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">AMP</h3>
        <button className="btn" onClick={run} disabled={loading || !url}>
          {loading ? 'Checking…' : 'Check'}
        </button>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {res && (
        <>
          {!res.hasAmp ? (
            <div className="text-sm">
              No <code>amphtml</code> link found on the page.
            </div>
          ) : (
            <>
              <div className="kv">
                <div className="k">URL</div>
                <div className="v break-all">
                  <a href={res.ampUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {res.ampUrl}
                  </a>
                </div>

                <div className="k">Status</div>
                <div className="v">{res.status}</div>

                <div className="k">{'<html amp>'} present</div>
                <div className="v">
                  <Badge ok={res.validHtmlFlag} />
                </div>

                <div className="k">Canonical back-link</div>
                <div className="v">
                  <Badge ok={res.hasCanonicalBack} />
                </div>
              </div>

              {(res.status >= 400 || !res.validHtmlFlag) && (
                <div className="text-xs text-amber-700">
                  ⚠️ AMP page may not be valid or accessible. Ensure it returns 200 and includes <code>{'<html amp>'}</code>.
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
