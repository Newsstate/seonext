'use client';
import { useState } from 'react';
import type { SEOResult, SecurityHeaders } from '@/lib/seo';

function Row({
  icon = '⚠️',
  title,
  count,
  children,
}: {
  icon?: string;
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!children;
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => hasChildren && setOpen(o => !o)}
        className={`w-full flex items-center justify-between py-2 text-left ${hasChildren ? 'hover:bg-gray-50' : ''}`}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="shrink-0">{icon}</span>
          <span className="font-medium">{title}</span>
          {typeof count === 'number' && <span className="text-xs text-gray-500">({count})</span>}
        </div>
        {hasChildren && <span className="text-xs text-gray-500">{open ? 'Hide' : 'Show'}</span>}
      </button>
      {hasChildren && open && <div className="pl-7 pb-3">{children}</div>}
    </div>
  );
}

export default function OverviewFindings({ data }: { data: SEOResult }) {
  // ---- Security header checks (typed safely) ----
  const sec: Partial<SecurityHeaders> = (data.http?.security ?? {}) as Partial<SecurityHeaders>;
  const missingHeaders: string[] = [];
  if (data.http?.scheme === 'https' && !sec?.hsts) missingHeaders.push('Strict-Transport-Security (HSTS)');
  if (!sec?.csp) missingHeaders.push('Content-Security-Policy');
  if (!sec?.xContentTypeOptions) missingHeaders.push('X-Content-Type-Options');
  if (!sec?.xFrameOptions) missingHeaders.push('X-Frame-Options');
  if (!sec?.referrerPolicy) missingHeaders.push('Referrer-Policy');

  // ---- Title/description ----
  const badTitle = data.titleLength < 30 || data.titleLength > 65;
  const badDesc = data.descriptionLength < 70 || data.descriptionLength > 160;

  // ---- Images (defensive defaults) ----
  const images = data.imagesList ?? [];
  const missingAlt = images.filter(i => !i.alt);
  const missingDim = images.filter(i => !i.width || !i.height);
  const notLazy  = images.filter(i => (i.loading ?? '').toLowerCase() !== 'lazy');

  // ---- Render-blocking (defensive defaults) ----
  const rb = data.renderBlocking ?? { stylesheets: 0, scriptsHeadBlocking: 0, scriptsTotal: 0 };
  const rbCss  = data.renderBlockingUrls?.stylesheets ?? [];
  const rbHead = data.renderBlockingUrls?.scriptsHeadBlocking ?? [];

  // ---- Links sample when very large pages ----
  const manyLinks = (data.links?.total ?? 0) > 300;
  const linksSample = data.linksSample ?? [];

  // ---- Duplication info (optional) ----
  const duplicate = !!(data.duplication && data.duplication.similarity !== undefined);

  return (
    <div className="card p-4">
      <h3 className="text-lg font-semibold mb-2">All Findings</h3>

      {/* Security headers */}
      <Row title="Security headers missing" count={missingHeaders.length}>
        {missingHeaders.length ? (
          <ul className="list-disc pl-6 text-sm">
            {missingHeaders.map(h => <li key={h}>{h}</li>)}
          </ul>
        ) : <div className="text-sm text-green-600">All key headers present.</div>}
      </Row>

      {/* Title / Description */}
      <Row title={`Title length ${badTitle ? 'suboptimal' : 'OK'} (${data.titleLength})`}>
        <div className="text-sm break-words">
          <code className="bg-gray-100 px-1 rounded">{data.title || '(missing)'}</code>
        </div>
      </Row>
      <Row title={`Description length ${badDesc ? 'suboptimal' : 'OK'} (${data.descriptionLength})`}>
        <div className="text-sm break-words">
          <code className="bg-gray-100 px-1 rounded">{data.metaDescription || '(missing)'}</code>
        </div>
      </Row>

      {/* Images */}
      <Row title="Images missing alt" count={missingAlt.length}>
        <ul className="list-disc pl-6 text-sm break-all">
          {missingAlt.map((i, idx) => <li key={idx}>{i.src}</li>)}
        </ul>
      </Row>
      <Row title="Images missing explicit width/height" count={missingDim.length}>
        <ul className="list-disc pl-6 text-sm break-all">
          {missingDim.map((i, idx) => <li key={idx}>{i.src}</li>)}
        </ul>
      </Row>
      <Row title="Images not using lazy loading" count={notLazy.length}>
        <ul className="list-disc pl-6 text-sm break-all">
          {notLazy.map((i, idx) => <li key={idx}>{i.src}</li>)}
        </ul>
      </Row>

      {/* Links (sample) */}
      <Row title={`Large number of links on page (${data.links?.total ?? 0})`} count={manyLinks ? linksSample.length : 0}>
        {manyLinks ? (
          <ul className="list-disc pl-6 text-sm break-all">
            {linksSample.map((l, idx) => (
              <li key={idx}>
                <span className={`mr-2 text-xs ${l.internal ? 'text-green-700' : 'text-blue-700'}`}>
                  {l.internal ? 'internal' : 'external'}
                </span>
                <a href={l.href} target="_blank" rel="noreferrer" className="underline">{l.href}</a>
                {l.rel ? <span className="ml-2 text-xs text-gray-500">rel="{l.rel}"</span> : null}
              </li>
            ))}
          </ul>
        ) : <div className="text-sm text-gray-600">Link volume is within normal range.</div>}
      </Row>

      {/* Render-blocking */}
      <Row title={`Render-blocking stylesheets (${rb.stylesheets})`} count={rbCss.length}>
        <ul className="list-disc pl-6 text-sm break-all">
          {rbCss.map((u, idx) => <li key={idx}><a href={u} className="underline" target="_blank" rel="noreferrer">{u}</a></li>)}
        </ul>
      </Row>
      <Row title={`Render-blocking scripts in <head> (${rb.scriptsHeadBlocking})`} count={rbHead.length}>
        <ul className="list-disc pl-6 text-sm break-all">
          {rbHead.map((u, idx) => <li key={idx}><a href={u} className="underline" target="_blank" rel="noreferrer">{u}</a></li>)}
        </ul>
      </Row>

      {/* Social meta quick checks */}
      {!data.twitter['twitter:card'] && (
        <Row title="Missing twitter:card">
          <div className="text-sm text-gray-600">
            Add <code className="bg-gray-100 px-1 rounded">meta name="twitter:card"</code> (summary or summary_large_image).
          </div>
        </Row>
      )}

      {/* Duplicate content */}
      {duplicate && (
        <Row title={`Content near-duplicate (similarity ${(data.duplication!.similarity! * 100).toFixed(0)}%)`}>
          {data.duplication?.comparedUrl ? (
            <a href={data.duplication!.comparedUrl} target="_blank" rel="noreferrer" className="underline text-sm break-all">
              {data.duplication!.comparedUrl}
            </a>
          ) : null}
        </Row>
      )}
    </div>
  );
}
