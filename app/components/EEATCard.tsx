'use client';
import { useState } from 'react';

type EEATScores = { experience: number; expertise: number; authoritativeness: number; trust: number };
type EEATOut = { verdict: string; scores?: EEATScores; flags?: string[]; recommendations?: string[] };

export default function EEATCard({
  url,
  onDone,
}: {
  url: string;
  onDone?: (data: EEATOut) => void;   // NEW
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EEATOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    try {
      setLoading(true); setError(null);
      const r = await fetch('/api/scan/eeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data: EEATOut = await r.json();
      if (!r.ok) throw new Error((data as any)?.error || 'Failed to run E-E-A-T check');
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
        <h3 className="text-lg font-semibold">AI E-E-A-T (on-demand)</h3>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? 'Scoring…' : 'Run Check'}
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {result && (
        <div className="text-sm">
          <div><b>Verdict:</b> {result.verdict}</div>
        </div>
      )}
    </div>
  );
}
