# SEO Magic (Next.js)

A Next.js (App Router) port of your SEO scanning tool, designed for Vercel.

## Features
- Cheerio-based static HTML parsing (fast, server-side)
- API routes:
  - `POST /api/scan` → fetch & parse SEO elements
  - `POST /api/psi`  → (optional) proxy to Google PSI (needs `PAGESPEED_API_KEY`)
  - `POST /api/export/csv` → export scan results to CSV
- Tailwind UI with clean cards and badges
- Findings (warnings/issues) heuristics
- CSV export from UI

## Quickstart
```bash
npm i
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel
- Push to GitHub and import in Vercel (Framework: Next.js)
- You **do not** need a `vercel.json`; modern runtime is auto-detected.
- If using PSI, add `PAGESPEED_API_KEY` in Vercel → Project → Settings → Environment Variables.

## Optional: Dynamic Rendering for JS-heavy pages
1. Install: `npm i puppeteer-core @sparticuz/chromium`
2. Create an alt route `/api/scan-render` that launches headless Chrome, calls `page.content()`, and then `parseSEO(...)`.
3. Increase function memory/time in Vercel if needed.

## Extend
- Add more checks (hreflang validation, canonical vs final URL, viewport/mobile friendliness, structured-data completeness, etc.).
- Persist history in Vercel KV/Postgres for teams and bulk audits.
- Add PDF export (server-side Puppeteer or external worker).

MIT License.
