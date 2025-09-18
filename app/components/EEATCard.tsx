'use client';
import { useState } from 'react';

export default function EEATCard({ url }: { url: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    try {
      setLoading(true); setError(null);
      const r = await fetch('/api/scan/eeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Failed to run E-E-A-T check');
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
        <h3 className="text-lg font-semibold">AI E-E-A-T Verdict (on-demand)</h3>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? 'Scoring…' : 'Run Check'}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Heuristic verdict for Experience, Expertise, Authoritativeness, Trust. Not included in the default scan.
      </p>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {result && (
        <div className="space-y-2">
          <div className="text-sm"><b>Overall verdict:</b> {result.verdict}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Experience: <b>{result.scores?.experience}</b></div>
            <div>Expertise: <b>{result.scores?.expertise}</b></div>
            <div>Authoritativeness: <b>{result.scores?.authoritativeness}</b></div>
            <div>Trust: <b>{result.scores?.trust}</b></div>
          </div>
          {result.flags?.length ? (
            <div className="text-sm">
              <b>Signals / Flags</b>
              <ul className="list-disc pl-5">
                {result.flags.map((f: string, i: number) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          ) : null}
          {result.recommendations?.length ? (
            <div className="text-sm">
              <b>Recommendations</b>
              <ul className="list-disc pl-5">
                {result.recommendations.map((f: string, i: number) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
