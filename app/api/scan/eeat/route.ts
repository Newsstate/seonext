import { NextRequest, NextResponse } from 'next/server';

function scoreBool(b: boolean, w = 1) { return (b ? 1 : 0) * w; }

function heuristicEEATSignals({ html, url }: { html: string; url: string }) {
  const lower = html.toLowerCase();

  // Signals (add/adjust to match your existing parser outputs)
  const hasAuthor = /author|byline|rel="author"|itemprop="author"/.test(lower);
  const hasDate = /datetime=|pubdate|datePublished|dateModified/.test(lower);
  const hasOrg = /organization|publisher|schema\.org\/(organization|newsmediaorganization)/.test(lower);
  const hasContact = /contact|about|privacy/.test(lower);
  const hasCitations = /<sup[^>]*>\s*\[\d+\]\s*<\/sup>|href=.*(wikipedia|doi\.org|researchgate|pubmed)/.test(lower);
  const hasSchema = /application\/ld\+json/.test(lower);
  const isHttps = url.startsWith('https://');
  const hasExternalLinks = /<a[^>]+href="https?:\/\/(?![^"]*yourdomain)/.test(lower);
  const hasAuthorBio = /bio|about the author|author-profile/.test(lower);
  const hasExpertTerms = /(PhD|MD|CA|CFA|Professor|Editor|Reviewed by)/i.test(html);

  // Basic scoring
  const experience = scoreBool(hasAuthorBio || hasAuthor, 2) + scoreBool(hasDate, 1);
  const expertise = scoreBool(hasExpertTerms, 2) + scoreBool(hasCitations, 1) + scoreBool(hasSchema, 1);
  const authoritativeness = scoreBool(hasOrg, 2) + scoreBool(hasExternalLinks, 1);
  const trust = scoreBool(isHttps, 1) + scoreBool(hasContact, 1) + scoreBool(hasSchema, 1);

  const to5 = (n: number) => Math.max(1, Math.min(5, Math.round(n + 2))); // normalize to 1..5 rough scale

  const scores = {
    experience: to5(experience),
    expertise: to5(expertise),
    authoritativeness: to5(authoritativeness),
    trust: to5(trust),
  };

  const total = (scores.experience + scores.expertise + scores.authoritativeness + scores.trust) / 4;
  const verdict = total >= 4.5 ? 'Excellent' : total >= 3.8 ? 'Good' : total >= 3.2 ? 'Fair' : 'Needs work';

  const flags: string[] = [];
  if (!hasAuthor && !hasAuthorBio) flags.push('No clear author/creator identity');
  if (!hasDate) flags.push('Missing publish/updated date');
  if (!hasOrg) flags.push('No explicit organization/publisher');
  if (!hasContact) flags.push('Missing Contact/About pages');
  if (!hasSchema) flags.push('No structured data (JSON-LD)');
  if (!hasCitations) flags.push('Few/No citations to authoritative sources');

  const recommendations: string[] = [];
  if (!hasAuthorBio) recommendations.push('Add author bio with credentials & role');
  if (!hasDate) recommendations.push('Expose datePublished/dateModified (HTML + JSON-LD)');
  if (!hasSchema) recommendations.push('Add Article/NewsArticle + Organization schema');
  if (!hasContact) recommendations.push('Link to About/Contact/Editorial policy in header/footer');
  if (!hasCitations) recommendations.push('Cite reputable, verifiable sources where claims are made');

  return { scores, verdict, flags, recommendations };
}

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL missing' }, { status: 400 });

    const r = await fetch(url, { redirect: 'follow' });
    const html = await r.text();

    const out = heuristicEEATSignals({ html, url });
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'E-E-A-T check failed' }, { status: 500 });
  }
}
