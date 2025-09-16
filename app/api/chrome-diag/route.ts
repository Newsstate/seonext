// app/api/chrome-diag/route.ts
import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import path from 'path';
export const runtime = 'nodejs';
export async function GET() {
  const p = await chromium.executablePath();
  const d = p ? path.dirname(p) : null;
  return NextResponse.json({
    executablePath: p,
    execDir: d,
    LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
    headless: chromium.headless,
  });
}
