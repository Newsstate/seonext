'use client';

import React, { useMemo, useState } from 'react';

type HreflangBack = { lang: string; href: string; ok: boolean };
type InRef = { url: string; anchor: string; nofollow: boolean };

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
  source: { url: string; finalUrl: string; status: number };
  robots: { blocked: boolean; matchedRule: any; sitemaps: string[] };
  sitemap: { tested: number; found: boolean; sample?: string | null };
  canonical: { pageCanonical: string | null; target?: { url?: string; status?: number; selfCanonical?: boolean; loopBack?: boolean } };
  amp?: { ampUrl?: string; backCanonicalOk?: boolean; status?: number } | null;
  hreflang: { total: number; checked: number; reciprocity: HreflangBack[] };
  headers: { xRobotsTag: string | null };
  conflicts: string[];
  pointers: {
    canonical: string | null;
    amphtml: string | null;
    ogUrl: string | null;
    twitterUrl: string | null;
    prev: string | null;
    next: string | null;
    manifest: string | null;
    hreflang: Array<{ lang: string; href: string }>;
    parameterizedLinksSample: string[];
  };
  inlinks: {
    searched: number;
    found: number;
    referrers: InRef[];
  };
  links: {
    nonAmp: { total: number; list: string[] };
    amp: { total: number; list: string[] } | null;
  };
  heavy: {
    page: { scanned: number; top10: AssetInfo[]; total: number; assets: AssetInfo[] };
    amp: { scanned: number; top10: AssetInfo[]; total: number; assets: AssetInfo[] } | null;
  };
};

export default function TouchpointsCard({ url }: { url: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Data | null>(null);

  const run = async () => {
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/touchpoints', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error || 'Failed'); else setRes(j.data);
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const Badge = ({ ok, textYes = 'OK', textNo = 'Issue' }: { ok: boolean; textYes?: string; textNo?: string }) => (
    <span className={`badge ml-2 ${ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
      {ok ? textYes : textNo}
    </span>
  );

  const fmtBytes = (n?: number | null) => {
    if (n == null || !isFinite(n)) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0; let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
  };

  // Link diffs (non-AMP vs AMP)
  const linkDiffs = useMemo(() => {
    if (!res) return null;
    const nonAmpSet = new Set(res.links?.nonAmp?.list || []);
    const ampList = res.links?.amp?.list || [];
    const ampSet = new Set(ampList);

    const inBoth: string[] = [];
    const onlyNonAmp: string[] = [];
    const onlyAmp: string[] = [];

    for (const u of nonAmpSet) {
      if (ampSet.has(u)) inBoth.push(u);
      else onlyNonAmp.push(u);
    }
    for (const u of ampSet) {
      if (!nonAmpSet.has(u)) onlyAmp.push(u);
    }

    return {
      inBoth: inBoth.slice(0, 200),
      onlyNonAmp: onlyNonAmp.slice(0, 200),
      onlyAmp: onlyAmp.slice(0, 200),
      counts: {
        nonAmp: res.links?.nonAmp?.total || 0,
        amp: res.links?.amp?.total || 0,
        overlap: inBoth.length
      }
    };
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
          {/* Summary & controls */}
          <div className="kv">
            <div className="k">Final URL</div><div className="v break-all">{res.source.finalUrl}</div>
            <div className="k">HTTP Status</div><div className="v">{res.source.status}</div>
            <div className="k">X-Robots-Tag</div><div className="v">{res.headers.xRobotsTag || '—'}</div>

            <div className="k">Robots.txt blocked?</div>
            <div className="v">
              {res.robots.blocked ? 'Yes' : 'No'}
              {res.robots.matchedRule?.path ? (
                <span className="ml-2 text-xs text-gray-600">
                  ({res.robots.matchedRule.type}:{res.robots.matchedRule.path})
                </span>
              ) : null}
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
          </div>

          {/* Hreflang */}
          <section>
            <h4 className="font-medium mb-2">Hreflang Reciprocity</h4>
            <div className="text-xs text-gray-600 mb-2">
              {res.hreflang.total} total; checked {res.hreflang.checked}
            </div>
            {res.hreflang.reciprocity.length ? (
              <ul className="list-disc pl-6 space-y-1">
                {res.hreflang.reciprocity.map((h, i) => (
                  <li key={i} className="break-all">
                    {h.lang}: {h.href} <Badge ok={h.ok} textYes="Back-ref OK" textNo="No back-ref" />
                  </li>
                ))}
              </ul>
            ) : <div className="text-sm text-gray-600">No hreflang pairs found.</div>}
          </section>

          {/* Internal Referrers */}
          <section>
            <h4 className="font-medium mb-2">Internal Referrers (sampled from sitemap)</h4>
            <div className="text-xs text-gray-600 mb-2">
              Checked {res.inlinks.searched} candidate pages; found {res.inlinks.found} inlinks.
            </div>
            {res.inlinks.referrers.length ? (
              <ul className="list-disc pl-6 space-y-1">
                {res.inlinks.referrers.map((r, i) => (
                  <li key={i} className="break-all">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">{r.url}</a>
                    {r.anchor && <span className="ml-2 text-gray-700">“{r.anchor}”</span>}
                    {r.nofollow && <span className="ml-2 badge bg-amber-100 text-amber-800">nofollow</span>}
                  </li>
                ))}
              </ul>
            ) : <div className="text-sm text-gray-600">No referrers found in sampled pages.</div>}
          </section>

          {/* Link Universe: Non-AMP & AMP (with diff) */}
          <section>
            <h4 className="font-medium mb-2">All Links (Non-AMP vs AMP)</h4>
            <div className="kv">
              <div className="k">Non-AMP links</div><div className="v">{res.links?.nonAmp?.total ?? 0}</div>
              <div className="k">AMP links</div><div className="v">{res.links?.amp?.total ?? 0}</div>
              {linkDiffs && (
                <>
                  <div className="k">Overlap</div><div className="v">{linkDiffs.counts.overlap}</div>
                </>
              )}
            </div>

            {linkDiffs && (
              <div className="grid md:grid-cols-3 gap-4 mt-3">
                <div>
                  <div className="font-medium mb-1">Only in Non-AMP</div>
                  {linkDiffs.onlyNonAmp.length ? (
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      {linkDiffs.onlyNonAmp.map((u, i) => <li key={'n'+i} className="break-all">{u}</li>)}
                    </ul>
                  ) : <div className="text-sm text-gray-600">—</div>}
                </div>
                <div>
                  <div className="font-medium mb-1">Only in AMP</div>
                  {linkDiffs.onlyAmp.length ? (
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      {linkDiffs.onlyAmp.map((u, i) => <li key={'a'+i} className="break-all">{u}</li>)}
                    </ul>
                  ) : <div className="text-sm text-gray-600">—</div>}
                </div>
                <div>
                  <div className="font-medium mb-1">In Both</div>
                  {linkDiffs.inBoth.length ? (
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      {linkDiffs.inBoth.map((u, i) => <li key={'b'+i} className="break-all">{u}</li>)}
                    </ul>
                  ) : <div className="text-sm text-gray-600">—</div>}
                </div>
              </div>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer select-none text-sm text-gray-700">Raw link lists</summary>
              <div className="mt-2 grid md:grid-cols-2 gap-4">
                <div>
                  <div className="font-medium mb-1">Non-AMP (first 1000)</div>
                  <pre className="code text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(res.links?.nonAmp?.list || [], null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="font-medium mb-1">AMP (first 1000)</div>
                  <pre className="code text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(res.links?.amp?.list || [], null, 2)}
                  </pre>
                </div>
              </div>
            </details>
          </section>

          {/* Heavy Assets */}
          <section>
            <h4 className="font-medium mb-2">Heavy Assets (by size)</h4>

            {/* Non-AMP */}
            <div className="mb-4">
              <div className="text-sm text-gray-700 mb-2">
                Non-AMP scanned {res.heavy.page.scanned} assets (top 10 shown).
              </div>
              {res.heavy.page.top10.length ? (
                <div className="overflow-x-auto">
                  <table className="table-pro w-full">
                    <thead>
                      <tr>
                        <th className="th-pro">Type</th>
                        <th className="th-pro">Size</th>
                        <th className="th-pro">Status</th>
                        <th className="th-pro">Content-Type</th>
                        <th className="th-pro">Blocking</th>
                        <th className="th-pro">3rd-party</th>
                        <th className="th-pro">URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.heavy.page.top10.map((a, i) => (
                        <tr key={'p'+i}>
                          <td className="td-pro">{a.type}</td>
                          <td className="td-pro">{fmtBytes(a.bytes)}</td>
                          <td className="td-pro">{a.status ?? '—'}</td>
                          <td className="td-pro">{a.contentType || '—'}</td>
                          <td className="td-pro">{a.blocking ? 'Yes' : 'No'}</td>
                          <td className="td-pro">{a.thirdParty ? 'Yes' : 'No'}</td>
                          <td className="td-pro break-all"><a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">{a.url}</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="text-sm text-gray-600">No assets found.</div>}
            </div>

            {/* AMP */}
            <div>
              <div className="text-sm text-gray-700 mb-2">
                AMP scanned {res.heavy.amp?.scanned ?? 0} assets (top 10 shown).
              </div>
              {res.heavy.amp?.top10?.length ? (
                <div className="overflow-x-auto">
                  <table className="table-pro w-full">
                    <thead>
                      <tr>
                        <th className="th-pro">Type</th>
                        <th className="th-pro">Size</th>
                        <th className="th-pro">Status</th>
                        <th className="th-pro">Content-Type</th>
                        <th className="th-pro">Blocking</th>
                        <th className="th-pro">3rd-party</th>
                        <th className="th-pro">URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.heavy.amp.top10.map((a, i) => (
                        <tr key={'a'+i}>
                          <td className="td-pro">{a.type}</td>
                          <td className="td-pro">{fmtBytes(a.bytes)}</td>
                          <td className="td-pro">{a.status ?? '—'}</td>
                          <td className="td-pro">{a.contentType || '—'}</td>
                          <td className="td-pro">{a.blocking ? 'Yes' : 'No'}</td>
                          <td className="td-pro">{a.thirdParty ? 'Yes' : 'No'}</td>
                          <td className="td-pro break-all"><a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">{a.url}</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="text-sm text-gray-600">No AMP assets found or AMP not present.</div>}
            </div>
          </section>

          {/* Conflicts */}
          {!!res.conflicts.length && (
            <section>
              <h4 className="font-medium mb-2">Conflicts</h4>
              <ul className="list-disc pl-6 space-y-1">
                {res.conflicts.map((c, i) => (
                  <li key={i} className="text-amber-700">{c}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Outbound pointers (raw) */}
          <details className="mt-3">
            <summary className="cursor-pointer select-none text-sm text-gray-700">All outbound touchpoints</summary>
            <pre className="code mt-2 whitespace-pre-wrap break-all">{JSON.stringify(res.pointers, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  );
}
