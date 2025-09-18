'use client';
import { useState } from 'react';

type Match = { url: string; title?: string; similarity?: number; snippet?: string };
type PlagOut = { overlap: number; matches: Match[] };

export default function PlagiarismCard({
  url,
  onDone,
}: {
  url: string;
  onDone?: (data: PlagOut) => void;   // NEW
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlagOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    try {
      setLoading(true); setError(null);
      const r = await fetch('/api/scan/plagiarism', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data: PlagOut = await r.json();
      if (!r.ok) throw new Error((data as any)?.error || 'Failed to run plagiarism check');
      setResult(data);
      onDone?.(data);                  // NEW: lift up to parent
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

      {error && <div className="text-sm text-red-600">{error}</div>}
      {/* keep inline preview if you like */}
      {result && (
        <ul className="list-disc pl-5 text-sm">
          {result.matches.slice(0, 6).map((m, i) => (
            <li key={i}>
              <a className="underline break-all" href={m.url} target="_blank" rel="noreferrer">
                {m.title || m.url}
              </a>
              {typeof m.similarity === 'number' ? ` — ${Math.round(m.similarity*100)}%` : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
