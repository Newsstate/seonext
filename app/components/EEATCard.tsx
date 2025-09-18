export default function EEATCard({
  url,
  onDone,                     // NEW
}: {
  url: string;
  onDone?: (data: { verdict: string; scores?: {experience:number;expertise:number;authoritativeness:number;trust:number}; flags?: string[]; recommendations?: string[] }) => void;
}) {
  // after fetch succeeds:
  const data = await r.json();
  setResult(data);
  onDone?.(data);             // NEW
}
