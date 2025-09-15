'use client';
import React, { useState } from 'react';

type AmpCheck = {
  hasAmp: boolean;
  ampUrl?: string;
  status?: number;
  validHtmlFlag?: boolean;
  hasCanonicalBack?: boolean;
  reason?: string;
  error?: string;
};

type DiffRow = { key: string; a: any; b: any; same: boolean };

export default function AmpCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<AmpCheck|null>(null);
  const [err, setErr] = useState<string|null>(null);

  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmp, setCmp] = useState<{
    sourceUrl: string;
    ampUrl: string;
    summary: { similar: boolean; textSimilarity: number; keyChangesCount: number };
    diffs: DiffRow[];
  }|null>(null);
  const [cmpErr, setCmpErr] = useState<string|null>(null);

  const run = async () => {
    setLoading(true); setErr(null); setRes(null); setCmp(null); setCmpErr(null);
    try {
      // Your existing /api/amp endpoint (you said it works already)
      const r = await fetch('/api/amp', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ url })
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed');
      else setRes(j.data as AmpCheck);
    } catch (e:any) {
      setErr(String(e.message||e));
    } finally {
      setLoading(false);
    }
  };

  const compare = async () => {
    if (!url) return;
    setCmpLoading(true); setCmpErr(null); setCmp(null);
    try {
      const r = await fetch('/api/amp-compare', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ url, ampUrl: res?.ampUrl })
      });
      const j = await r.json();
      if (!j.ok) setCmpErr(j.error || 'Failed');
      else setCmp(j.data);
    } catch (e:any) {
      setCmpErr(String(e.message||e));
    } finally {
      setCmpLoading(false);
    }
  };

  const Badge = ({ ok, yes='Yes', no='No' }:{ ok:boolean, yes?:string, no?:string }) => (
    <span className={`badge ml-2 ${ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
      {ok ? yes : no}
    </span>
  );

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">AMP</h3>
        <div className="flex gap-2">
          <button className="btn" onClick={run} disabled={loading || !url}>
            {loading ? 'Checking…' : 'Check'}
          </button>
          {!!res?.hasAmp && (
            <button className="btn" onClick={compare} disabled={cmpLoading}>
              {cmpLoading ? 'Comparing…' : 'Compare AMP vs Non-AMP'}
            </button>
          )}
        </div>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {res && (
        <>
          {!res.hasAmp ? (
            <div className="text-sm">
              No <code>amphtml</code> link found on the page{res.reason ? `: ${res.reason}` : '.'}
            </div>
          ) : (
            <div className="kv">
              <div className="k">AMP URL</div><div className="v break-all">{res.ampUrl || '—'}</div>
              {'status' in res && (<><div className="k">Status</div><div className="v">{res.status}</div></>)}
              {'validHtmlFlag' in res && (<><div className="k">{'<html amp>'} present</div><div className="v"><Badge ok={!!res.validHtmlFlag} /></div></>)}
              {'hasCanonicalBack' in res && (<><div className="k">Canonical back-link</div><div className="v"><Badge ok={!!res.hasCanonicalBack} /></div></>)}
            </div>
          )}
        </>
      )}

      {cmpErr && <div className="text-red-600 text-sm">{cmpErr}</div>}

      {cmp && (
        <>
          <div className="kv">
            <div className="k">Source</div><div className="v break-all">{cmp.sourceUrl}</div>
            <div className="k">AMP</div><div className="v break-all">{cmp.ampUrl}</div>
            <div className="k">Text similarity (Jaccard)</div><div className="v">{cmp.summary.textSimilarity.toFixed(3)} <Badge ok={cmp.summary.similar} yes="Similar" no="Different" /></div>
            <div className="k">Changed fields</div><div className="v">{cmp.summary.keyChangesCount}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th className="th-pro">Field</th>
                  <th className="th-pro">Non-AMP</th>
                  <th className="th-pro">AMP</th>
                  <th className="th-pro">Same?</th>
                </tr>
              </thead>
              <tbody>
                {cmp.diffs.map((d, i) => (
                  <tr key={i} className={d.same ? '' : 'text-amber-700'}>
                    <td className="td-pro">{d.key}</td>
                    <td className="td-pro break-all">{(d.a ?? '—').toString()}</td>
                    <td className="td-pro break-all">{(d.b ?? '—').toString()}</td>
                    <td className="td-pro">{d.same ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
