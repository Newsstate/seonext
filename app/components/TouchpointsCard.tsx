'use client';
import React, { useMemo, useState } from 'react';

type HreflangBack = { lang: string; href: string; ok: boolean };
type InRef = { url:string; anchor:string; nofollow:boolean };
type AssetInfo = {
  url: string;
  type: 'script' | 'style' | 'image' | 'font' | 'media' | 'preload' | 'other';
  status?: number;
  contentType?: string | null;
  bytes?: number | null;
  thirdParty: boolean;
  blocking?: boolean;
};

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
  links: {
    nonAmp: { total:number; list:string[] };
    amp: { total:number; list:string[] } | null;
  };
  heavy: {
    page: { scanned:number; top10:AssetInfo[]; total:number; assets:AssetInfo[] };
    amp: { scanned:number; top10:AssetInfo[]; total:number; assets:AssetInfo[] } | null;
  };
};

function fmtKB(n?: number | null) {
  if (n == null) return '—';
  return `${(n/1024).toFixed(1)} KB`;
}

export default function TouchpointsCard({ url }:{ url:string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [res, setRes] = useState<Data|null>(null);
  const [showAllLinks, setShowAllLinks] = useState<'nonamp'|'amp'|null>(null);

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

  const linkDiff = useMemo(()=>{
    if (!res?.links) return null;
    const A = new Set(res.links.nonAmp.list || []);
    const B = new Set(res.links.amp?.list || []);
    const inAmpNotInPage = res.links.amp ? res.links.amp.list.filter(u => !A.has(u)) : [];
    const inPageNotInAmp = res.links.nonAmp.list.filter(u => !B.has(u));
    return { inAmpNotInPage: inAmpNotInPage.slice(0, 100), inPageNotInAmp: inPageNotInAmp.slice(0, 100) };
  }, [res]);

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
          {/* Basics */}
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
                <div className="text-xs text-gray-600 mt-1">
                  Target: {res.canonical.target.url} ({res.canonical.target.status ?? '—'})
                  <Badge ok={!!res.canonical.target.selfCanonical} textYes="Self-canonical" textNo="Not self" />
                  {res.canonical.target.loopBack !== undefined && (
                    <Badge ok={!res.canonical.target.loopBack} textYes="No loop" textNo="Loop!" />
                  )}
                </div>
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

          {/* Internal Referrers */}
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

          {/* NEW: Links on Non-AMP vs AMP */}
          <div>
            <h4 className="font-medium mb-2">All Links (Non-AMP vs AMP)</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 rounded border">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Non-AMP Links</div>
                  <div className="text-xs text-gray-600">{res.links.nonAmp.total} total</div>
                </div>
                <button className="btn mt-2" onClick={()=>setShowAllLinks(showAllLinks==='nonamp' ? null : 'nonamp')}>
                  {showAllLinks==='nonamp' ? 'Hide list' : 'Show list'}
                </button>
                {showAllLinks==='nonamp' && (
                  <ul className="list-disc pl-6 mt-2 space-y-1 max-h-64 overflow-auto">
                    {res.links.nonAmp.list.map((u,i)=>(<li key={i} className="break-all">{u}</li>))}
                  </ul>
                )}
              </div>

              <div className="p-3 rounded border">
                <div className="flex items-center justify-between">
                  <div className="font-medium">AMP Links</div>
                  <div className="text-xs text-gray-600">{res.links.amp ? res.links.amp.total : 0} total</div>
                </div>
                {res.links.amp ? (
                  <>
                    <button className="btn mt-2" onClick={()=>setShowAllLinks(showAllLinks==='amp' ? null : 'amp')}>
                      {showAllLinks==='amp' ? 'Hide list' : 'Show list'}
                    </button>
                    {showAllLinks==='amp' && (
                      <ul className="list-disc pl-6 mt-2 space-y-1 max-h-64 overflow-auto">
                        {res.links.amp.list.map((u,i)=>(<li key={i} className="break-all">{u}</li>))}
                      </ul>
                    )}
                  </>
                ) : <div className="text-sm text-gray-600 mt-2">No AMP version detected.</div>}
              </div>
            </div>

            {/* Diffs */}
            {res.links.amp && linkDiff && (
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="p-3 rounded border">
                  <div className="font-medium mb-1">Present in AMP, not in Non-AMP</div>
                  {linkDiff.inAmpNotInPage.length ? (
                    <ul className="list-disc pl-6 space-y-1 max-h-48 overflow-auto">
                      {linkDiff.inAmpNotInPage.map((u,i)=>(<li key={i} className="break-all text-amber-700">{u}</li>))}
                    </ul>
                  ) : <div className="text-sm text-gray-600">—</div>}
                </div>
                <div className="p-3 rounded border">
                  <div className="font-medium mb-1">Present in Non-AMP, not in AMP</div>
                  {linkDiff.inPageNotInAmp.length ? (
                    <ul className="list-disc pl-6 space-y-1 max-h-48 overflow-auto">
                      {linkDiff.inPageNotInAmp.map((u,i)=>(<li key={i} className="break-all text-amber-700">{u}</li>))}
                    </ul>
                  ) : <div className="text-sm text-gray-600">—</div>}
                </div>
              </div>
            )}
          </div>

          {/* NEW: Heavy Assets */}
          <div>
            <h4 className="font-medium mb-2">Heavy Assets (by size)</h4>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 rounded border">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Non-AMP page</div>
                  <div className="text-xs text-gray-600">scanned {res.heavy.page.scanned}</div>
                </div>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-1 pr-2">Type</th>
                      <th className="py-1 pr-2">KB</th>
                      <th className="py-1 pr-2">Status</th>
                      <th className="py-1 pr-2">3rd</th>
                      <th className="py-1 pr-2">Blocking</th>
                      <th className="py-1">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.heavy.page.top10.map((a, i)=>(
                      <tr key={i} className="border-b last:border-0 align-top">
