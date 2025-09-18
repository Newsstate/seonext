// add in props:
export default function PlagiarismCard({
  url,
  onDone,                     // NEW
}: {
  url: string;
  onDone?: (data: { overlap: number; matches: Array<{url: string; title?: string; similarity?: number; snippet?: string}> }) => void;
}) {
  // after fetch succeeds:
  const data = await r.json();
  // ...
  setResult(data);
  onDone?.(data);             // NEW
}
