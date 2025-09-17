// app/api/scan/stream/route.ts
import { NextRequest } from 'next/server';
import got from 'got';
import {
  parseSEO,
  extractMainText,
  readabilityStats,
  scoreFrom,
} from '@/lib/seo';

export const runtime = 'nodejs';

type Step =
  | 'overview'
  | 'content'
  | 'headings'
  | 'images'
  | 'links'
  | 'meta'
  | 'openGraph'
  | 'twitter'
  | 'canonical'
  | 'hreflang'
  | 'robots'
  | 'sitemap'
  | 'amp'
  | 'performance'
  | 'security'
  | 'structured'
  | 'scoring';

type ProgressEvent = {
  status: 'start' | 'progress' | 'done' | 'error';
  step?: Step;
  substep?: string;
  percent?: number;
  done?: boolean;
  message?: string;
  data?: any; // final payload
};

const sse = (obj: ProgressEvent) => `data: ${JSON.stringify(obj)}\n\n`;

async function fetchHtml(url: string, ua: string) {
  return got(url, {
    http2: true,
    headers: { 'user-agent': ua },
    timeout: { request: 15000 },
    retry: { limit: 1 },
    followRedirect: true,
  });
}

// simple helpers
const countRegex = (html: string, re: RegExp) =>
  (html.match(re) || []).length;

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const url = u.searchParams.get('url');
  if (!url) {
    return new Response(sse({ status: 'error', message: 'Missing url' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (ev: ProgressEvent) =>
        controller.enqueue(encoder.encode(sse(ev)));
      const start = (step: Step, sub?: string, p?: number) =>
        write({ status: 'progress', step, substep: sub, percent: p });
      const done = (step: Step, p?: number) =>
        write({ status: 'progress', step, done: true, percent: p });

      // keep-alive for proxies
      const hb = setInterval(() => {
        controller.enqueue(encoder.encode(':hb\n\n'));
      }, 15000);

      try {
        let pct = 0;
        const bump = (delta: number) => (pct = Math.min(100, pct + delta));

        // % allocation across all stages (sums to 100)
        // 6 + 10 + 5 + 6 + 8 + 8 + 5 + 4 + 4 + 4 + 6 + 4 + 5 + 10 + 3 + 7 + 5 = 100
        const inc = {
          overview: 6, content: 10, headings: 5, images: 6, links: 8, meta: 8,
          openGraph: 5, twitter: 4, canonical: 4, hreflang: 4, robots: 6,
          sitemap: 4, amp: 5, performance: 10, security: 3, structured: 7, scoring: 5,
        };

        // 1) OVERVIEW
        start('overview', 'Fetching HTML', bump(3));
        const ua = 'Mozilla/5.0 (compatible; SEO-Stream/2.0; +https://example.com)';
        const resp = await fetchHtml(url, ua);
        const body = resp.body;
        const headers = resp.headers as any;
        const finalUrl = (resp as any).url || url;

        start('overview', 'Extracting page basics', pct + 2);
        const main = extractMainText(body);
        const contentStats = readabilityStats(main.text);
        done('overview', pct = 6);

        // 2) CONTENT
        start('content', 'Readability & word count', pct + 5);
        // (contentStats already computed)
        start('content', 'Main text length', pct + 3);
        done('content', pct += inc.content);

        // 3) HEADINGS
        start('headings', 'Counting H1–H6', pct + 2);
        const h1 = countRegex(body, /<h1\b[^>]*>/gi);
        const h2 = countRegex(body, /<h2\b[^>]*>/gi);
        const h3 = countRegex(body, /<h3\b[^>]*>/gi);
        const h4 = countRegex(body, /<h4\b[^>]*>/gi);
        const h5 = countRegex(body, /<h5\b[^>]*>/gi);
        const h6 = countRegex(body, /<h6\b[^>]*>/gi);
        (headers as any); // silence lint
        done('headings', pct += inc.headings);

        // 4) IMAGES
        start('images', 'Scanning <img> + alt attributes', pct + 3);
        const imgCount = countRegex(body, /<img\b[^>]*>/gi);
        const imgWithAlt = countRegex(body, /<img\b[^>]*\balt=/gi);
        done('images', pct += inc.images);

        // 5) LINKS (+ parse everything)
       // 5) LINKS (+ parse everything)
start('links', 'Parsing DOM & links', pct + 3);
const parsed = parseSEO(body, url, headers, resp.statusCode);
parsed.finalUrl = finalUrl;
parsed.redirected = parsed.finalUrl !== url;

// Support both shapes: summary object (current) OR array (future-proof)
let internalLinks = 0, externalLinks = 0;
const pAny = parsed as any;

if (Array.isArray(pAny.linkList)) {
  internalLinks = pAny.linkList.filter((l: any) => l.internal).length;
  externalLinks = pAny.linkList.filter((l: any) => !l.internal).length;
} else if (Array.isArray(pAny.links)) {
  internalLinks = pAny.links.filter((l: any) => l.internal).length;
  externalLinks = pAny.links.filter((l: any) => !l.internal).length;
} else if (pAny.links && typeof pAny.links === 'object') {
  // current shape from parseSEO(): { total, internal, external, nofollow }
  internalLinks = Number(pAny.links.internal) || 0;
  externalLinks = Number(pAny.links.external) || 0;
}

start(
  'links',
  `Classified ${internalLinks} internal / ${externalLinks} external`,
  pct + 3
);
done('links', (pct += inc.links));


        // 6) META
        start('meta', 'Title & Description', pct + 3);
        const title = parsed.title ?? null;
        const description = parsed.description ?? null;
        (parsed as any).metaAudit = {
          titleLength: title ? title.length : 0,
          descriptionLength: description ? description.length : 0,
          hasTitle: !!title,
          hasDescription: !!description,
        };
        done('meta', pct += inc.meta);

        // 7) OPEN GRAPH
        start('openGraph', 'og:title / og:description / og:image', pct + 2);
        const og = parsed.og || {};
        (parsed as any).openGraphAudit = {
          hasTitle: !!og.title,
          hasDescription: !!og.description,
          hasImage: !!og.image,
        };
        done('openGraph', pct += inc.openGraph);

        // 8) TWITTER
        start('twitter', 'twitter:card / twitter:title / twitter:image', pct + 2);
        const tw = parsed.twitter || {};
        (parsed as any).twitterAudit = {
          hasCard: !!tw.card,
          hasTitle: !!tw.title,
          hasImage: !!tw.image,
        };
        done('twitter', pct += inc.twitter);

        // 9) CANONICAL
        start('canonical', 'Checking canonical href', pct + 2);
        const canonical = parsed.canonical ?? null;
        done('canonical', pct += inc.canonical);

        // 10) HREFLANG
        start('hreflang', 'Validating hreflang set', pct + 2);
        const hreflang = parsed.hreflang ?? [];
        done('hreflang', pct += inc.hreflang);

        // 11) ROBOTS
        start('robots', 'Robots meta / X-Robots-Tag', pct + 3);
        const robotsMeta = parsed.meta?.robots ?? null;
        const xRobots = headers['x-robots-tag'] ?? null;
        (parsed as any).robotsAudit = { robotsMeta, xRobots };
        done('robots', pct += inc.robots);

        // 12) SITEMAP
        start('sitemap', 'Sitemap hint / discovery', pct + 2);
        const sitemap = parsed.sitemap ?? null;
        done('sitemap', pct += inc.sitemap);

        // 13) AMP
        start('amp', 'AMP link rel=amphtml', pct + 2);
        if (parsed.ampHtml) {
          try {
            await fetchHtml(parsed.ampHtml, ua);
            (parsed as any).ampFetched = true;
          } catch {
            (parsed as any).ampFetched = false;
          }
        } else {
          (parsed as any).ampFetched = false;
        }
        done('amp', pct += inc.amp);

        // 14) PERFORMANCE
        start('performance', 'Render-blocking & timings', pct + 5);
        const rb = parsed.renderBlocking || {
          stylesheets: [],
          scriptsHeadBlocking: [],
          scriptsTotal: 0,
        };
        // @ts-ignore
        const timings = resp.timings || {};
        (parsed as any).performance = {
          blockingCSS: rb.stylesheets?.length || 0,
          blockingHeadScripts: rb.scriptsHeadBlocking?.length || 0,
          scriptsTotal: rb.scriptsTotal || 0,
          totalMs:
            (timings.phases && timings.phases.total) ||
            (timings.response && timings.response) ||
            undefined,
        };
        done('performance', pct += inc.performance);

        // 15) SECURITY
        start('security', 'HTTPS & content-type', pct + 2);
        (parsed as any).security = {
          https: finalUrl.startsWith('https://'),
          contentType: headers['content-type'],
        };
        done('security', pct += inc.security);

        // 16) STRUCTURED DATA
        start('structured', 'JSON-LD / Microdata audit', pct + 4);
        // parsed.schemaTypes / parsed.schemaAudit (from your parser)
        done('structured', pct += inc.structured);

        // finalize overview + extra facts
        (parsed as any).overview = {
          url: finalUrl,
          statusCode: resp.statusCode,
          title,
          description,
          wordCount: contentStats.words,
          readingTimeMin: contentStats.readingTimeMin,
          headings: { h1, h2, h3, h4, h5, h6 },
          images: { total: imgCount, withAlt: imgWithAlt },
          redirected: parsed.redirected,
        };

        // 17) SCORING
        start('scoring', 'Computing overall score', pct + 2);
        parsed.contentStats = contentStats;
        parsed.score = scoreFrom(parsed);
        done('scoring', 100);

        write({ status: 'done', percent: 100, data: parsed });
      } catch (err: any) {
        write({ status: 'error', message: String(err?.message || err) });
      } finally {
        if (!closed) controller.close();
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

