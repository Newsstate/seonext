'use client';
import React, { useState } from 'react';

type HreflangBack = { lang: string; href: string; ok: boolean };
type InRef = { url:string; anchor:string; nofollow:boolean };

type Data = {
  source: { url:string; finalUrl:string; status:number };
  robots: { blocked:boolean; matchedRule:any; sitemaps:string[] };
  sitemap: { tested:number; found:boolean; sample?:string|null };
  canonical: { pageCanonical:string|null; target?: { url?:string; status?:number; selfCanonical?:boolean; loopBack?:boolean } };
  amp: { ampUrl?:string; backCanonicalOk?:boolean; status?:number } | null;
  hreflang: { total:number; checked:number; reciprocity:HreflangBack[] };
  headers: { xRobotsTag:string|null };
  conflicts: string[];
  pointers: {
    canonical: string|null;
    amphtml: string|null;
    ogUrl: string|null;
    twitterUrl: string|null;
    prev: string|null;
    next: string|null;
    manifest: string|null;
    hreflang: Array<{lang:string; href:string}>;
    parameterizedLinksSample: string[];
  };
  inlinks: {
    searched: number;
    found: number;
    referrers: InRef[];
  };
};

export default function TouchpointsCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [res, setRes] = useState<Data|null>(null);

  const run = async () => {
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/touchpoints', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ url })
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setRes(j.data);
    } catch (e:any) {
      setErr(String(e.message||e));
    } finally {
      setLoading(false);
    }
  };

  const Badge = ({ ok, textYes='OK', textNo='Issue' }:{ ok:boolean; textYes?:string; textNo?:string }) => (
    <span className={`badge ml-2 ${ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
      {ok ? textYes : textNo}
    </span>
  );

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Touchpoints & Reciprocity</h3>
        <button className="btn" onClick={run} disabled={loading || !url}>
          {loading ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {res && (
        <>
          <div className="kv">
            <div className="k">Final URL</div><div className="v break-all">{res.source.finalUrl}</div>
            <div className="k">HTTP Status</div><div className="v">{res.source.status}</div>
            <div className="k">X-Robots-Tag</div><div className="v">{res.headers.xRobotsTag || '—'}</div>

            <div className="k">Robots.txt blocked?</div>
            <div className="v">
              {res.robots.blocked ? 'Yes' : 'No'}
              {res.robots.matchedRule?.path ? <span className="ml-2 text-xs text-gray-600">({res.robots.matchedRule.type}:{res.robots.matchedRule.path})</span> : null}
            </div>

            <div className="k">In Sitemap?</div>
            <div className="v">
              {res.sitemap.found ? 'Yes' : 'No'} <span className="text-xs text-gray-500">tested {res.sitemap.tested} file(s)</span>
              {res.sitemap.sample ? <span className="ml-2 text-xs text-gray-600">sample: {res.sitemap.sample}</span> : null}
            </div>

            <div className="k">Canonical</div>
            <div className="v">
              {res.canonical.pageCanonical || '—'}
              {res.canonical.target?.url && (
                <>
                  <div className="text-xs text-gray-600 mt-1">
                    Target: {res.canonical.target.url} ({res.canonical.target.status ?? '—'})
                    <Badge ok={!!res.canonical.target.selfCanonical} textYes="Self-canonical" textNo="Not self" />
                    {res.canonical.target.loopBack !== undefined && (
                      <Badge ok={!res.canonical.target.loopBack} textYes="No loop" textNo="Loop!" />
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="k">AMP</div>
            <div className="v">
              {res.amp?.ampUrl || '—'}
              {res.amp?.ampUrl && <Badge ok={!!res.amp?.backCanonicalOk} textYes="Canonical back OK" textNo="Missing back-link" />}
            </div>

            <div className="k">Hreflang</div>
            <div className="v">
              {res.hreflang.total} total; checked {res.hreflang.checked}
              {res.hreflang.reciprocity.length ? (
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  {res.hreflang.reciprocity.map((h, i)=>(
                    <li key={i} className="break-all">
                      {h.lang}: {h.href} <Badge ok={h.ok} textYes="Back-ref OK" textNo="No back-ref" />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {/* NEW: Internal Referrers via Sitemap sampling */}
          <div>
            <h4 className="font-medium mb-2">Internal Referrers (sampled from sitemap)</h4>
            <div className="text-xs text-gray-600 mb-2">
              Checked {res.inlinks.searched} candidate pages; found {res.inlinks.found} inlinks.
            </div>
            {res.inlinks.referrers.length ? (
              <ul className="list-disc pl-6 space-y-1">
                {res.inlinks.referrers.map((r, i)=>(
                  <li key={i} className="break-all">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">{r.url}</a>
                    {r.anchor && <span className="ml-2 text-gray-700">“{r.anchor}”</span>}
                    {r.nofollow && <span className="ml-2 badge bg-amber-100 text-amber-800">nofollow</span>}
                  </li>
                ))}
              </ul>
            ) : <div className="text-sm text-gray-600">No referrers found in sampled pages.</div>}
          </div>

          {!!res.pointers.parameterizedLinksSample.length && (
            <div>
              <h4 className="font-medium mb-2">Potential “trap” links (params)</h4>
              <ul className="list-disc pl-6 space-y-1">
                {res.pointers.parameterizedLinksSample.map((u, i)=>(
                  <li key={i} className="break-all">{u}</li>
                ))}
              </ul>
            </div>
          )}

          {!!res.conflicts.length && (
            <div>
              <h4 className="font-medium mb-2">Conflicts</h4>
              <ul className="list-disc pl-6 space-y-1">
                {res.conflicts.map((c, i)=>(
                  <li key={i} className="text-amber-700">{c}</li>
                ))}
              </ul>
            </div>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer select-none text-sm text-gray-700">All outbound touchpoints</summary>
            <pre className="code mt-2">{JSON.stringify(res.pointers, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  );
}
