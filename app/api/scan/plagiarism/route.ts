import { NextRequest, NextResponse } from 'next/server';
type Match = {
  url: string;
  title?: string;
  similarity?: number;
  snippet?: string;
};
// Optional: If you want web search, add an external search provider here (Bing, SerpAPI, etc).
// Keep it stubbed/off by default to avoid background work during normal scans.

async function extractMainText(html: string) {
  // ultra-lightweight text extraction (you can swap in Readability/cheerio from your stack)
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Example local “similar passage” finder (naive shingling) — you can replace with search API.
function makeShingles(text: string, size = 12) {
  const words = text.split(/\s+/).filter(Boolean);
  const shingles = new Set<string>();
  for (let i = 0; i < words.length - size; i++) shingles.add(words.slice(i, i + size).join(' ').toLowerCase());
  return shingles;
}

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL missing' }, { status: 400 });

    const r = await fetch(url, { redirect: 'follow' });
    const html = await r.text();
    const text = await extractMainText(html);
    if (!text) return NextResponse.json({ overlap: 0, matches: [] });

    // Naive baseline: compute overlap against the page itself (used for internal dup paragraphs)
    // Real web matches: integrate a search API using random shingles as queries.
    const shingles = makeShingles(text);
    const overlap = Math.min(0.98, Math.max(0, shingles.size > 0 ? 0.15 + (text.length > 6000 ? 0.1 : 0) : 0)); // placeholder heuristic

    // Placeholder “matches” payload to show UI; replace with real search results if you wire an API.
    const matches = []; // e.g., [{ url, title, similarity: 0.64, snippet }]

return NextResponse.json<{ overlap: number; matches: Match[] }>({ overlap, matches });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Plagiarism check failed' }, { status: 500 });
  }
}

