'use client';
import { useState } from 'react';

export default function PlagiarismCard({ url }: { url: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    try {
      setLoading(true); setError(null);
      const r = await fetch('/api/scan/plagiarism', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Failed to run plagiarism check');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Potentially matching sources (plagiarism)</h3>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? 'Checking…' : 'Run Check'}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        On-demand scan that extracts page text and searches for overlapping passages on the web.
        Not included in the default scan.
      </p>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {result && (
        <div className="space-y-2">
          <div className="text-sm">
            <b>Overall overlap:</b> {Math.round((result.overlap || 0)*100)}%
          </div>
          <div className="text-sm">
            <b>Matches found:</b> {result.matches?.length || 0}
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {(result.matches || []).map((m: any, i: number) => (
              <li key={i} className="text-sm">
                <a className="underline break-all" href={m.url} target="_blank" rel="noreferrer">{m.title || m.url}</a>
                {typeof m.similarity === 'number' ? ` — similarity ${Math.round(m.similarity*100)}%` : null}
                {m.snippet ? <div className="text-xs text-gray-500 mt-1">“{m.snippet}”</div> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
