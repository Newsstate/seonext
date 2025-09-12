import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

/**
 * Accepts an array of scan results and returns a CSV.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const arr = Array.isArray(body) ? body : [];
    const cols = [
      'url','finalUrl','title','metaDescription','canonical','robots','viewport','lang',
      'h1Count','links.total','links.internal','links.external','links.nofollow',
      'images.total','images.missingAlt','schemaTypes','og.og:title','og.og:description'
    ];
    const header = cols.join(',');
    const lines = arr.map((item:any)=>{
      const pick = (path:string) => path.split('.').reduce((a:any,k)=> (a ? a[k] : undefined), item);
      const values = cols.map(c => {
        const v = pick(c);
        const s = Array.isArray(v) ? v.join('|') : (v ?? '');
        const escaped = String(s).replace(/"/g,'""');
        return `"${escaped}"`;
      });
      return values.join(',');
    });
    const csv = [header, ...lines].join('\n');
    return new Response(csv, {
      status: 200,
      headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="seo-export.csv"' }
    });
  } catch (e:any){
    return new Response('Bad Request', { status:400 });
  }
}
