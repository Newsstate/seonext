import { NextRequest } from 'next/server';
import got from 'got';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

type LinkItem = {
  url: string;
  text?: string;
  relNofollow: boolean;
  internal: boolean;
  status?: number;
  finalUrl?: string;
  contentType?: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { url, maxLinks = 60 } = body;
  if (!url) return new Response(JSON.stringify({ ok:false, error:'Missing url' }), { status:400 });

  const ua = 'Mozilla/5.0 (compatible; SEOMagic/1.3; +https://example.com)';

  try {
    const page = await got(url, { http2:true, headers:{ 'user-agent': ua }, timeout:{ request:15000 }, retry:{ limit:1 } });
    const $ = cheerio.load(page.body);
    const origin = new URL(url).origin;
    const linksSet = new Map<string, LinkItem>();

    $('a[href]').each((_, el) => {
      const hrefRaw = String($(el).attr('href') || '').trim();
      if (!hrefRaw) return;
      const lower = hrefRaw.toLowerCase();
      if (lower.startsWith('#') || lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('javascript:') || lower.startsWith('data:')) return;
      let abs: string;
      try { abs = new URL(hrefRaw, origin).toString(); } catch { return; }
      if (!/^https?:/i.test(abs)) return;
      const rel = String($(el).attr('rel') || '').toLowerCase();
      const text = ($(el).text() || '').trim().slice(0, 120);
      if (!linksSet.has(abs)) {
        const internal = new URL(abs).origin === origin;
        linksSet.set(abs, { url: abs, text, relNofollow: rel.includes('nofollow'), internal });
      }
    });

    const links = Array.from(linksSet.values()).slice(0, maxLinks);
    const limit = Math.min(8, links.length || 1);
    let idx = 0;

    async function worker() {
      while (idx < links.length) {
        const i = idx++;
        const l = links[i];
        try {
          const r = await got(l.url, { method:'HEAD', throwHttpErrors:false, http2:true, headers:{ 'user-agent': ua }, timeout:{ request:12000 }, retry:{ limit:0 } });
          if (r.statusCode === 405 || r.statusCode === 501) {
            const g = await got(l.url, { method:'GET', throwHttpErrors:false, http2:true, headers:{ 'user-agent': ua }, timeout:{ request:12000 }, retry:{ limit:0 } });
            l.status = g.statusCode; l.finalUrl = g.url; l.contentType = String(g.headers['content-type']||'');
          } else {
            l.status = r.statusCode; l.finalUrl = r.url; l.contentType = String(r.headers['content-type']||'');
          }
        } catch (e:any) { l.error = String(e.message || e); }
      }
    }
    await Promise.all(Array.from({ length: limit }, () => worker()));

    const summary = {
      total: links.length,
      internal: links.filter(l => l.internal).length,
      external: links.filter(l => !l.internal).length,
      broken: links.filter(l => (typeof l.status === 'number' ? l.status >= 400 : l.error)).length,
      nofollow: links.filter(l => l.relNofollow).length
    };

    return new Response(JSON.stringify({ ok:true, data: { summary, links } }), { status:200, headers:{ 'content-type':'application/json' } });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e.message||e) }), { status:500, headers:{ 'content-type':'application/json' } });
  }
}
