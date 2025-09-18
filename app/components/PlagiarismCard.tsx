'use client';

import React, { useState } from 'react';

export default function PlagiarismCard({
  url,                    // kept for compatibility (not used)
  targetId,               // optional alternative to the data-section selector
  onReveal,               // optional callback if parent wants to control visibility
}: {
  url?: string;
  targetId?: string;      // e.g. "plagiarism-section"
  onReveal?: () => void;
}) {
  const [showing, setShowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const reveal = () => {
    // Prefer parent handler if provided
    if (onReveal) {
      onReveal();
    } else {
      // Default: unhide a section in the DOM and scroll to it
      const sel = targetId
        ? `#${CSS.escape(targetId)}`
        : '[data-section="plagiarism"]';
      const el = document.querySelector<HTMLElement>(sel);
      if (el) {
        el.classList.remove('hidden');
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const onClick = async () => {
    try {
      setBusy(true);
      reveal();
      setShowing(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between">
      <div className="text-sm font-medium">
        Potentially matching sources (plagiarism)
      </div>
      <button
        onClick={onClick}
        disabled={busy || showing}
        className={`px-3 py-1.5 rounded-lg text-white text-sm ${
          busy || showing ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {busy ? 'Opening…' : showing ? 'Shown below' : 'Run Check'}
      </button>
    </div>
  );
}
