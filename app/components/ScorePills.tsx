'use client';
export default function ScorePills({ data }:{ data:any }){
  const issues:number = (data._issues || []).length;
  const warnings:number = (data._warnings || []).length;
  const ok = Math.max(0, 10 - issues - warnings);
  return (
    <div className="flex gap-2">
      <span className="badge">OK: {ok}</span>
      <span className="badge">Warnings: {warnings}</span>
      <span className="badge">Issues: {issues}</span>
    </div>
  );
}
