// app/api/cache/route.ts
import { NextRequest } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

type AssetKind = 'css' | 'js' | 'img';

type AssetRow = {
  url: string;
  finalUrl: string;
  kind: AssetKind;
  status: number;
  bytes: number | null;
  contentType: string | null;
  contentEncoding: string | null;
  cacheControl: string | null;
  maxAge: number | null;
  etag: string | null;
  lastModified: string | null;
  vary: string | null;
  compressed: boolean;
  sameOrigin: boolean;
  notes: string[];
};

function abs(base: URL, href?: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

function parseMaxAge(v?: string | null): number | null {
  if (!v) return null;
  const m = v.match(/(?:s-maxage|max-age)\s*=\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

async function headOrLightGet(url: string) {
  // Try HEAD first
  try {
    const h = await got(url, {
      method: 'HEAD',
      throwHttpErrors: false,
      timeout: { request: 15000 },
      followRedirect: true,
    });
    const len = Number(h.headers['content-length'] || NaN);
    return {
      status: h.statusCode,
      finalUrl: h.url,
      headers: h.headers,
      bytes: Number.isFinite(len) ? len : null,
      via: 'HEAD' as const,
    };
  } catch {
    // Fallback to a tiny ranged GET to infer total size via Content-Range
    try {
      const g = await got(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        throwHttpErrors: false,
        timeout: { request: 15000 },
        followRedirect: true,
      });
      const cr = String(g.headers['content-range'] || '');
      const m = cr.match(/\/(\d+)\s*$/);
      const total = m ? Number(m[1]) : null;
      return {
        status: g.statusCode,
        finalUrl: g.url,
        headers: g.headers,
        bytes: total,
        via: 'GET' as const,
      };
    } catch (e: any) {
      return {
        status: 0,
        finalUrl: url,
        headers: {} as Record<string, any>,
        bytes: null,
        via: 'ERR' as const,
        error: String(e?.message || e),
      };
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, limit = 80 } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing url' }), { status: 400 });
    }

    const page = await got(url, {
      followRedirect: true,
      throwHttpErrors: false,
      timeout: { request: 15000 },
    });

    if (page.statusCode >= 400) {
      return new Response(JSON.stringify({ ok: false, error: `${page.statusCode} on page` }), { status: 200 });
    }

    const base = new URL(page.url);
    const $ = cheerio.load(page.body);

    // Collect assets (fixed: do not return number from .each)
    const assetsRaw: Array<{ url: string; kind: AssetKind }> = [];

    $('link[rel="stylesheet"][href]').each((_, el) => {
      const href = $(el).attr('href');
      const u = abs(base, href ? String(href) : undefined);
      if (u) assetsRaw.push({ url: u, kind: 'css' });
    });

    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      const u = abs(base, src ? String(src) : undefined);
      if (u) assetsRaw.push({ url: u, kind: 'js' });
    });

    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      const u = abs(base, src ? String(src) : undefined);
      if (u) assetsRaw.push({ url: u, kind: 'img' });
    });

    // De-dupe and cap
    const seen = new Set<string>();
    const assets = assetsRaw.filter(a => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    }).slice(0, Math.max(10, Math.min(200, Number(limit) || 80)));

    // Probe caching for each asset
    const rows: AssetRow[] = [];
    for (const a of assets) {
      const meta = await headOrLightGet(a.url);
      const h = meta.headers || ({} as Record<string, any>);
      const ct = (h['content-type'] ? String(h['content-type']) : null);
      const enc = (h['content-encoding'] ? String(h['content-encoding']) : null);
      const cc = (h['cache-control'] ? String(h['cache-control']) : null);
      const vary = (h['vary'] ? String(h['vary']) : null);
      const etag = (h['etag'] ? String(h['etag']) : null);
      const lm = (h['last-modified'] ? String(h['last-modified']) : null);
      const maxAge = parseMaxAge(cc);
      const compressed = !!(enc && /br|gzip|deflate/i.test(enc));
      const finalUrl = meta.finalUrl || a.url;

      let sameOrigin = false;
      try { sameOrigin = new URL(finalUrl).origin === base.origin; } catch {}

      const notes: string[] = [];
      if (!cc) notes.push('No Cache-Control header.');
      if (maxAge == null) notes.push('No max-age/s-maxage.');
      if (!etag && !lm) notes.push('No validators (ETag/Last-Modified).');
      if (!compressed && ct && /text|json|javascript|xml|svg|font/i.test(ct)) notes.push('Not compressed (gzip/br).');

      rows.push({
        url: a.url,
        finalUrl,
        kind: a.kind,
        status: meta.status,
        bytes: meta.bytes,
        contentType: ct,
        contentEncoding: enc,
        cacheControl: cc,
        maxAge,
        etag,
        lastModified: lm,
        vary,
        compressed,
        sameOrigin,
        notes,
      });
    }

    // Sort heaviest first
    rows.sort((x, y) => (y.bytes || 0) - (x.bytes || 0));

    const counts = {
      found: assetsRaw.length,
      checked: rows.length,
      css: rows.filter(r => r.kind === 'css').length,
      js: rows.filter(r => r.kind === 'js').length,
      img: rows.filter(r => r.kind === 'img').length,
      errors: rows.filter(r => r.status === 0 || r.status >= 400).length,
      uncompressedTextAssets: rows.filter(r => !r.compressed && r.contentType && /text|json|javascript|xml|svg|font/i.test(r.contentType)).length,
      noCacheControl: rows.filter(r => !r.cacheControl).length,
    };

    const totalBytes = rows.reduce((s, r) => s + (r.bytes || 0), 0);

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          page: page.url,
          counts,
          totalBytes,
          items: rows,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
}
