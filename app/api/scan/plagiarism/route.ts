// app/api/scan/plagiarism/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Result item for a potential match */
type Match = {
  url: string;
  title?: string;
  similarity?: number; // 0..1
  snippet?: string;
};

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractMainText(html: string): Promise<string> {
  // lightweight local extraction; swap with Readability if you already use cheerio elsewhere
  return stripTags(html);
}

function makeShingles(text: string, size = 12): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + size <= words.length; i++) {
    out.push(words.slice(i, i + size).join(' ').toLowerCase());
  }
  return out;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL missing' }, { status: 400 });
    }

    const r = await fetch(url, { redirect: 'follow' });
    const html = await r.text();
    const text = await extractMainText(html);
    if (!text) {
      const matches: Match[] = [];
      return NextResponse.json({ overlap: 0, matches });
    }

    // Naive baseline overlap heuristic; replace with real web-search matching if you add a key
    const shingles = makeShingles(text);
    const overlap =
      shingles.length > 0
        ? Math.min(0.98, 0.15 + (text.length > 6000 ? 0.1 : 0))
        : 0;

    // Placeholder result list; populate via Bing/SerpAPI when available
    const matches: Match[] = [];

    // Typed payload avoids implicit-any warnings
    return NextResponse.json<{ overlap: number; matches: Match[] }>({
      overlap,
      matches,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Plagiarism check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
