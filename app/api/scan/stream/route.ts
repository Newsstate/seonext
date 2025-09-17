import { NextRequest } from 'next/server';
import { runContentAnalysis } from "@/lib/contentAnalysis";
import got from 'got';
import {
  parseSEO,
  extractMainText,
  readabilityStats,
  scoreFrom,
  type SEOResult,
} from '@/lib/seo';

export const runtime = 'nodejs';

type Step =
  | 'overview'
  | 'content'
  | 'contentAnalysis'   // ← NEW
  | 'plagiarism'        // ← NEW
  | 'seoOptimization'   // ← NEW
  | 'spamSignals'       // ← NEW
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
  data?: any;
};

const sse = (obj: ProgressEvent) => `data: ${JSON.stringify(obj)}\n\n`;
const countRegex = (html: string, re: RegExp) => (html.match(re) || []).length;

async function fetchHtml(url: string, ua: string) {
  return got(url, {
    http2: true,
    headers: { 'user-agent': ua },
    timeout: { request: 15000 },
    retry: { limit: 1 },
    followRedirect: true,
  });
}

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

      const hb = setInterval(() => {
        controller.enqueue(encoder.encode(':hb\n\n'));
      }, 15000);

      try {
        let pct = 0;
        const inc = {
          overview: 6, content: 10, headings: 5, images: 6, links: 8, meta: 8,
          openGraph: 5, twitter: 4, canonical: 4, hreflang: 4, robots: 6,
          sitemap: 4, amp: 5, performance: 10, security: 3, structured: 7, scoring: 5,
        } as const;

        // 1) OVERVIEW
        start('overview', 'Fetching HTML', (pct += 3));
        const ua = 'Mozilla/5.0 (compatible; SEO-Stream/2.0; +https://example.com)';
        const resp = await fetchHtml(url, ua);
        const body = resp.body;
        const headers: Record<string, any> = resp.headers as any;
        const finalUrl = (resp as any).url || url;

        start('overview', 'Extracting page basics', pct + 2);
        const main = extractMainText(body);
        const contentStats = readabilityStats(main.text);
        done('overview', (pct = 6));

        // 2) CONTENT
        start('content', 'Readability & word count', pct + 5);
        start('content', 'Main text length', pct + 3);
        done('content', (pct += inc.content));

        // 3) HEADINGS
        start('headings', 'Counting H1–H6', pct + 2);
        const h1 = countRegex(body, /<h1\b[^>]*>/gi);
        const h2 = countRegex(body, /<h2\b[^>]*>/gi);
        const h3 = countRegex(body, /<h3\b[^>]*>/gi);
        const h4 = countRegex(body, /<h4\b[^>]*>/gi);
        const h5 = countRegex(body, /<h5\b[^>]*>/gi);
        const h6 = countRegex(body, /<h6\b[^>]*>/gi);
        done('headings', (pct += inc.headings));

        // 4) IMAGES
        start('images', 'Scanning <img> + alt attributes', pct + 3);
        const imgCount = countRegex(body, /<img\b[^>]*>/gi);
        const imgWithAlt = countRegex(body, /<img\b[^>]*\balt=/gi);
        done('images', (pct += inc.images));

        // 5) LINKS (+ parse everything)
        start('links', 'Parsing DOM & links', pct + 3);
        const parsed: SEOResult = parseSEO(body, url, headers, resp.statusCode);

        // annotate navigation info without fighting TS
        (parsed as any).finalUrl = finalUrl;
        (parsed as any).redirected = finalUrl !== url;

        const internalLinks = Number(parsed.links.internal) || 0;
        const externalLinks = Number(parsed.links.external) || 0;

        start('links', `Classified ${internalLinks} internal / ${externalLinks} external`, pct + 3);
        done('links', (pct += inc.links));

        // 6) META
        start('meta', 'Title & Description', pct + 3);
        const title = parsed.title ?? null;
        const description = parsed.metaDescription ?? null;
        (parsed as any).metaAudit = {
          titleLength: parsed.titleLength,
          descriptionLength: parsed.descriptionLength,
          hasTitle: !!parsed.title,
          hasDescription: !!parsed.metaDescription,
        };
        done('meta', (pct += inc.meta));


       // --- CONTENT ANALYSIS ---
start('contentAnalysis', 'Analyzing content length, language & readability', pct + 1);
let analysis;
try {
  analysis = await runContentAnalysis({
    html: body, // ← use fetched HTML
    url,
    title: parsed.title,
    h1: (parsed.headingsList || []).find(h => h.level === 'h1')?.text,
    metaDescription: parsed.metaDescription,
    images: parsed.images,
    internalLinkCount: parsed.links?.internal ?? 0,
  });
  (parsed as any).contentAnalysis = analysis; // ← assign to parsed
} catch {
  (parsed as any).contentAnalysis = undefined;
}
done('contentAnalysis', pct += 3);

// --- PLAGIARISM ---
start('plagiarism', 'Checking plagiarism (EN/HI snippets)', pct + 1);
// (runContentAnalysis already did the check; this stage is for streaming UX)
done('plagiarism', pct += 2);

// --- SEO OPTIMIZATION ---
start('seoOptimization', 'Scoring SEO optimization (keywords & on-page signals)', pct + 1);
done('seoOptimization', pct += 2);

// --- SPAM SIGNALS ---
start('spamSignals', 'Scanning spam signals (stuffing/hidden text/doorway)', pct + 1);
done('spamSignals', pct += 2);


// --- SEO OPTIMIZATION ---
start("seoOptimization", "Scoring SEO optimization (keywords & on-page signals)", pct + 1);
try {
  // already inside _analysis; nothing extra to compute
} catch {}
done("seoOptimization", pct += 2);

// --- SPAM SIGNALS ---
start("spamSignals", "Scanning spam signals (stuffing/hidden text/doorway)", pct + 1);
try {
  // already inside _analysis; nothing extra to compute
} catch {}
done("spamSignals", pct += 2);
        
        // 7) OPEN GRAPH
        start('openGraph', 'og:title / og:description / og:image', pct + 2);
        const og = parsed.og || {};
        (parsed as any).openGraphAudit = {
          hasTitle: !!og['og:title'],
          hasDescription: !!og['og:description'],
          hasImage: !!og['og:image'],
        };
        done('openGraph', (pct += inc.openGraph));

        // 8) TWITTER
        start('twitter', 'twitter:card / twitter:title / twitter:image', pct + 2);
        const tw = parsed.twitter || {};
        (parsed as any).twitterAudit = {
          hasCard: !!tw['twitter:card'],
          hasTitle: !!tw['twitter:title'],
          hasImage: !!tw['twitter:image'],
        };
        done('twitter', (pct += inc.twitter));

        // 9) CANONICAL
        start('canonical', 'Checking canonical href', pct + 2);
        const canonical = parsed.canonical ?? null;
        const canonicalStatus = parsed.canonicalStatus;
        (parsed as any).canonicalAudit = { canonical, canonicalStatus };
        done('canonical', (pct += inc.canonical));

        // 10) HREFLANG
        start('hreflang', 'Validating hreflang set', pct + 2);
        (parsed as any).hreflangAudit = {
          map: parsed.hreflangMap,
          validation: parsed.hreflangValidation,
        };
        done('hreflang', (pct += inc.hreflang));

        // 11) ROBOTS
        start('robots', 'Robots meta / X-Robots-Tag', pct + 3);
        const robotsMeta = parsed.robotsMeta;
        const xRobots = parsed.http?.xRobotsTag || null;
        (parsed as any).robotsAudit = { robotsMeta, xRobots };
        done('robots', (pct += inc.robots));

        // 12) SITEMAP (not provided by parser; keep placeholder)
        start('sitemap', 'Sitemap hint / discovery', pct + 2);
        (parsed as any).sitemap = null;
        done('sitemap', (pct += inc.sitemap));

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
        done('amp', (pct += inc.amp));

        // 14) PERFORMANCE
        start('performance', 'Render-blocking & timings', pct + 5);
        const rb = parsed.renderBlocking || {
          stylesheets: 0,
          scriptsHeadBlocking: 0,
          scriptsTotal: 0,
        };
        const timings: any = (resp as any).timings || {};
        (parsed as any).performance = {
          blockingCSS: rb.stylesheets,
          blockingHeadScripts: rb.scriptsHeadBlocking,
          scriptsTotal: rb.scriptsTotal,
          totalMs:
            (timings.phases && timings.phases.total) ||
            (timings.response && timings.response) ||
            undefined,
        };
        done('performance', (pct += inc.performance));

        // 15) SECURITY
        start('security', 'HTTPS & security headers', pct + 2);
        (parsed as any).security = {
          scheme: parsed.http?.scheme,
          headers: parsed.http?.security,
        };
        done('security', (pct += inc.security));

        // 16) STRUCTURED DATA
        start('structured', 'JSON-LD / Microdata audit', pct + 4);
        // parsed.schemaTypes / parsed.schemaAudit already set by parser
        done('structured', (pct += inc.structured));

        // finalize overview
        (parsed as any).overview = {
          url: finalUrl,
          statusCode: parsed.http?.status,
          title,
          description,
          wordCount: contentStats.words,
          readingTimeMin: contentStats.readMinutes,
          headings: { h1, h2, h3, h4, h5, h6 },
          images: { total: imgCount, withAlt: imgWithAlt },
          redirected: finalUrl !== url,
        };

        // 17) SCORING
        start('scoring', 'Computing overall score', pct + 2);
        (parsed as any).contentStats = contentStats; // matches your type
        parsed.score = scoreFrom(parsed);
        done('scoring', 100);

        write({ status: 'done', percent: 100, data: parsed });
      } catch (err: any) {
        write({ status: 'error', message: String(err?.message || err) });
      } finally {
        clearInterval(hb);
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


