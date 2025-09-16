// app/api/crawl-hints/route.ts
import { NextRequest } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

type Finding = { type: string; detail: string; sample?: string };

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url: string };
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });

    const resp = await got(url, { followRedirect: true, throwHttpErrors: false, timeout: { request: 20000 } });
    if (resp.statusCode >= 400) {
      return new Response(JSON.stringify({ ok:false, error:`Source returned ${resp.statusCode}` }), { status:200 });
    }

    const $ = cheerio.load(resp.body);
    const findings: Finding[] = [];
    const recommends: string[] = [];

    // rel=next/prev (deprecated but still a hint)
    const relNext = $('link[rel="next"]').attr('href');
    const relPrev = $('link[rel="prev"]').attr('href');
    if (relNext) findings.push({ type:'pagination', detail:'rel="next" present', sample: relNext });
    if (relPrev) findings.push({ type:'pagination', detail:'rel="prev" present', sample: relPrev });

    // Parameter & path patterns that look like pagination
    const samples = new Set<string>();
    $('a[href]').each((_, el)=>{
      const href = String($(el).attr('href') || '');
      if (!href) return;
      const abs = new URL(href, resp.url).toString();

      // Common pagination patterns
      if (/[?&](page|p|pg|start|offset|cursor)=\d+/i.test(abs) || /\/page\/\d+(\b|\/)/i.test(abs)) {
        if (samples.size < 10) samples.add(abs);
      }

      // Infinite scroll or "load more"
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('load more') || text.includes('show more')) {
        findings.push({ type:'infinite-scroll', detail:'Anchor suggests "Load more"', sample: abs });
      }
    });
    if (samples.size) findings.push({ type:'pagination', detail:'Pagination URL patterns detected', sample: Array.from(samples)[0] });

    // Script hints for infinite scroll libraries
    const scriptText = $('script').map((_, s)=>$(s).html() || '').get().join('\n').toLowerCase();
    if (/infinite[-\s]?scroll|loadmore|ajax[-\s]?pagination|next[-\s]?page/i.test(scriptText)) {
      findings.push({ type:'infinite-scroll', detail:'Script suggests infinite scroll/paginating loader' });
    }

    // Faceted URLs (potential crawl traps)
    const facetParams = new Set<string>();
    $('a[href]').slice(0, 500).each((_, el)=>{
      try {
        const u = new URL(String($(el).attr('href') || ''), resp.url);
        const params = Array.from(u.searchParams.keys());
        params.forEach(k=>{
          if (/^(sort|order|view|per_page|filter|color|size|session|ref|utm_)/i.test(k)) {
            facetParams.add(k);
          }
        });
      } catch {}
    });
    if (facetParams.size) findings.push({ type:'facets', detail:`Facet/UTM params seen: ${Array.from(facetParams).slice(0,6).join(', ')}` });

    // Suggestions
    if (samples.size) recommends.push('Use consistent pagination URLs; avoid endless variants.');
    if (facetParams.size) recommends.push('Disallow faceted/UTM params in robots.txt or add canonical to canonicalized list pages.');
    if (findings.some(f=>f.type==='infinite-scroll')) recommends.push('Provide paginated, link-discoverable paths for infinite scroll (e.g., /page/2) and ensure content is SSR for discoverability.');
    if (relNext || relPrev) recommends.push('Ensure paginated series have self-referencing canonicals and logical internal links.');
    
    return new Response(JSON.stringify({
      ok: true,
      data: {
        url: resp.url,
        findings,
        recommends,
      }
    }), { status:200, headers:{ 'content-type':'application/json' }});
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
