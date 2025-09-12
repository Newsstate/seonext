'use client';
export default function ReadabilityCard({ data }:{ data:any }) {
  const c = data?.contentStats;
  if (!c) return null;
  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-semibold">Content quality</h3>
      <div className="kv">
        <div className="k">Words</div><div className="v">{c.words}</div>
        <div className="k">Sentences</div><div className="v">{c.sentences}</div>
        <div className="k">Est. read</div><div className="v">{c.readMinutes} min</div>
        <div className="k">Flesch score</div><div className="v">{c.flesch}</div>
      </div>
    </div>
  );
}
