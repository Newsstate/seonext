'use client';

import { useState } from 'react';
import ScanForm from '@/components/ScanForm';
import ResultCard from '@/components/ResultCard';

export default function Page() {
  const [result, setResult] = useState<any | null>(null);

  const onExportCSV = async () => {
    if (!result) return;
    const r = await fetch('/api/export/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([result]),
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seo-export.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">SEO Scan</h1>
        <a className="text-sm text-gray-600 hover:underline" href="https://vercel.com" target="_blank" rel="noreferrer">
          Deploy on Vercel →
        </a>
      </header>

      {/* The form streams progress and calls setResult when done */}
      <ScanForm onResult={setResult} defaultUrl="https://example.com" />

      {result && (
        <>
          <ResultCard data={result} />
          <div className="flex justify-end">
            <button className="btn" onClick={onExportCSV}>Export CSV</button>
          </div>
        </>
      )}

      <footer className="text-xs text-gray-500 pt-6">
        Optional features available: PageSpeed Insights proxy, dynamic-render fallback using puppeteer-core (@sparticuz/chromium).
      </footer>
    </main>
  );
}
