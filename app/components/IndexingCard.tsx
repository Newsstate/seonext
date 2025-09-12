import { NextRequest } from 'next/server';
import got from 'got';
import React, { useState } from 'react';

export const runtime = 'nodejs';

type RobotsInfo = {
  found: boolean;
  status?: number;
  size?: number;
  sitemaps: string[];
  allow: string[];
  disallow: string[];
  crawlDelay?: string;
  notes?: string[];
};

type SitemapSummary = {
  url: string;
  type: 'index'|'urlset'|'unknown';
  count?: number;
};

type IndexingResult = {
  origin: string;
  robots: RobotsInfo;
  sitemaps: {
    found: boolean;
    list: SitemapSummary[];
    totalUrls?: number;
    checkedCount: number;
    foundPageInSitemap: boolean;
  }
};

function originOf(target: string){ return new URL(target).origin; }
function normalizeUrl(base: string, maybe: string){
  try { return new URL(maybe, base).toString(); } catch { return maybe; }
}

function parseRobots(txt: string, base: string): RobotsInfo {
  const lines = txt.split(/\r?\n/);
  const allow: string[] = [], disallow: string[] = [], sitemaps: string[] = [], notes: string[] = [];
  let crawlDelay: string | undefined; let userAgentStar = false;

  for (const raw of lines){
    const line = raw.split('#')[0].trim(); if (!line) continue;
    const idx = line.indexOf(':'); if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx+1).trim();
    if (key === 'user-agent') userAgentStar = (val === '*');
    else if (key === 'allow' && userAgentStar) allow.push(val);
    else if (key === 'disallow' && userAgentStar) disallow.push(val);
    else if (key === 'crawl-delay' && userAgentStar) crawlDelay = val;
    else if (key === 'sitemap') sitemaps.push(normalizeUrl(base, val));
  }
  if (!userAgentStar) notes.push('No explicit rules for User-agent: *');
  return { found: true, sitemaps, allow, disallow, crawlDelay, notes };
}

async function fetchText(url: string){
  const r = await got(url, { http2:true, timeout:{request:15000}, retry:{limit:1},
    headers:{ 'user-agent':'Mozilla/5.0 (compatible; SEOMagic/1.1)' } });
  return { status:r.statusCode, url:r.url, body:r.body, size:Number(r.headers['content-length']||r.body?.length||0) };
}
async function fetchXml(url: string){
  const r = await got(url, { http2:true, timeout:{request:15000}, retry:{limit:1},
    headers:{ 'user-agent':'Mozilla/5.0 (compatible; SEOMagic/1.1)', 'accept':'application/xml,text/xml,*/*' } });
  return { status:r.statusCode, url:r.url, body:r.body };
}

export async function POST(req: NextRequest){
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });

    const origin = originOf(url);

    // robots.txt
    let robots: RobotsInfo = { found:false, sitemaps:[], allow:[], disallow:[] };
    try {
      const r = await fetchText(`${origin}/robots.txt`);
      robots = parseRobots(r.body, origin);
      robots.found = true; robots.status = r.status; robots.size = r.size;
    } catch {
      robots = { found:false, sitemaps:[], allow:[], disallow:[], notes:['robots.txt not found or unreachable'] };
    }

    // discover sitemaps
    let sitemapCandidates = [...robots.sitemaps];
    for (const guess of [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-index.xml`]) {
      if (!sitemapCandidates.includes(guess)) sitemapCandidates.push(guess);
    }

    const parser = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'' });
    const list: SitemapSummary[] = [];
    let foundPageInSitemap = false, checkedCount = 0, totalUrls = 0;
    const pageUrl = new URL(url).toString();

    for (const sm of sitemapCandidates.slice(0,5)){
      try {
        const x = await fetchXml(sm); checkedCount++;
        const data:any = parser.parse(x.body || '');
        if (data?.sitemapindex){
          const s = data.sitemapindex.sitemap;
          const arr = Array.isArray(s) ? s : (s ? [s] : []);
          list.push({ url:x.url, type:'index', count:arr.length });
          for (const child of arr.slice(0,5)){
            const loc = child?.loc; if (!loc) continue;
            try {
              const c = await fetchXml(loc); checkedCount++;
              const cdata:any = parser.parse(c.body || '');
              if (cdata?.urlset){
                const u = cdata.urlset.url;
                const urls = Array.isArray(u) ? u : (u ? [u] : []);
                totalUrls += urls.length;
                if (urls.some((e:any)=> { try { return e?.loc && new URL(e.loc).toString() === pageUrl; } catch { return false; } })) {
                  foundPageInSitemap = true;
                }
              }
            } catch {}
          }
        } else if (data?.urlset){
          const u = data.urlset.url;
          const urls = Array.isArray(u) ? u : (u ? [u] : []);
          list.push({ url:x.url, type:'urlset', count:urls.length });
          totalUrls += urls.length;
          if (urls.some((e:any)=> { try { return e?.loc && new URL(e.loc).toString() === pageUrl; } catch { return false; } })) {
            foundPageInSitemap = true;
          }
        } else {
          list.push({ url:x.url, type:'unknown' });
        }
      } catch {}
    }

    const res: IndexingResult = {
      origin,
      robots,
      sitemaps: { found: list.length>0, list, totalUrls, checkedCount, foundPageInSitemap }
    };

    return new Response(JSON.stringify({ ok:true, data: res }), { status:200, headers:{'content-type':'application/json'} });
  } catch (e:any){
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500 });
  }
}
