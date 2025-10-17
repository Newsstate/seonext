'use client';
import React, { useState } from 'react';

export default function DiscoverCard() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, useAI: true })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      setReport(j);
    } catch (e:any) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="rounded-2xl border p-5 shadow-sm">
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 rounded-lg border px-3 py-2"
          placeholder="https://example.com/article"
          value={url}
          onChange={e=>setUrl(e.target.value)}
        />
        <button onClick={run} disabled={!url || loading}
          className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50">
          {loading ? 'Scanning…' : 'Discover Check'}
        </button>
      </div>

      {error && <p className="mt-3 text-red-600">{error}</p>}

      {report && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Discover Readiness</h3>
              <p className="text-sm text-gray-600">{report.url}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{report.overallScore}</div>
              <div className="text-sm uppercase tracking-wide text-gray-500">{report.chance}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(report.pillars).map(([k,v]: any) => (
              <div key={k} className="rounded-xl border p-3">
                <div className="text-xs uppercase text-gray-500">{k}</div>
                <div className="text-xl font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <div>
            <h4 className="font-semibold mb-2">Findings</h4>
            <ul className="space-y-2">
              {report.findings.map((f:any)=>(
                <li key={f.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{f.title}</span>
                    <span className="text-xs px-2 py-1 rounded-full border">{f.severity}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{f.detail}</p>
                  {f.recommendation && <p className="text-sm mt-1"><span className="font-medium">Fix:</span> {f.recommendation}</p>}
                </li>
              ))}
            </ul>
          </div>

            {report.aiSuggestions && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border p-4">
                  <h4 className="font-semibold mb-1">AI Title Ideas</h4>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {report.aiSuggestions.improvedTitle?.map((t:string,i:number)=>(<li key={i}>{t}</li>))}
                  </ul>
                  <h4 className="font-semibold mt-4 mb-1">AI Intros</h4>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {report.aiSuggestions.improvedIntro?.map((t:string,i:number)=>(<li key={i}>{t}</li>))}
                  </ul>
                </div>
                <div className="rounded-xl border p-4">
                  <h4 className="font-semibold mb-1">Lead Image Briefs</h4>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {report.aiSuggestions.imageBriefs?.map((t:string,i:number)=>(<li key={i}>{t}</li>))}
                  </ul>
                  {report.aiSuggestions.schemaPatch && (
                    <>
                      <h4 className="font-semibold mt-4 mb-1">JSON-LD Patch (suggested)</h4>
                      <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-2 rounded-lg border">
                        {JSON.stringify(report.aiSuggestions.schemaPatch, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            )}

          {report.aiSuggestions?.checklist && (
            <div className="rounded-xl border p-4">
              <h4 className="font-semibold mb-1">High-Impact Checklist</h4>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {report.aiSuggestions.checklist.map((t:string,i:number)=>(<li key={i}>{t}</li>))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
