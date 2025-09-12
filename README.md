# SEO Insight (Next.js on Vercel)

This is a minimal Next.js port of your Python-based SEO scanner. It:
- Provides a simple UI at `/`.
- Offers an API endpoint at `/api/scan` to fetch a URL and parse SEO elements using Cheerio (static HTML).
- Is deployable on Vercel with Node.js runtime (see `vercel.json`).

> If you need JavaScript-rendered pages (like your FastAPI + Playwright flow), enable Puppeteer Mode (instructions below).

## Quickstart (Local)

```bash
pnpm i   # or npm i / yarn
pnpm dev # http://localhost:3000
```

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Create a new Vercel project and import the repo.
3. Ensure the default build settings are fine (Framework: Next.js). Deploy.

`vercel.json` already pins a Node.js runtime and increases memory/time for `/api/scan`.

## API

`POST /api/scan` with JSON:
```json
{ "url": "https://example.com" }
```
Response:
```json
{
  "ok": true,
  "data": {
    "title": "...",
    "metaDescription": "...",
    "canonical": "...",
    "robots": "...",
    "h1Count": 1,
    "links": {"total":0,"internal":0,"external":0,"nofollow":0},
    "og": { "og:title":"...", ... },
    "twitter": { "twitter:card":"...", ... },
    "schemaTypes": ["Article", "BreadcrumbList"]
  }
}
```

## Puppeteer Mode (Optional for JS-rendered pages)

Vercel functions can't run full Playwright easily, but you can use `puppeteer-core` + `@sparticuz/chromium`:

1. Install deps:
```bash
npm i puppeteer-core @sparticuz/chromium
```
2. In `src/app/api/scan/route.ts`, switch to the commented `renderWithChromium(...)` code and pass the resulting HTML into `parseSEO(html, url)`.
3. Increase function limits in `vercel.json` (memory/time). Note this increases cold starts and may hit timeouts on heavy pages.

## Notes vs Your Python App

- Your Python app uses FastAPI, Jinja templates, and Playwright for fully rendered HTML. This port focuses on static HTML first for speed and Vercel compatibility.
- If you rely on PageSpeed Insights, add a separate API route that calls Google PSI (server-side) with your `PAGESPEED_API_KEY` env var.
- For bulk scanning, use a background queue off-Vercel (or Vercel Cron + storage).

## Customization

- Extend the parser in `src/lib/seo.ts` to add checks (LCP images, hreflang, viewport, AMP, etc.).
- Style the UI however you like (Tailwind, shadcn/ui, etc.).
