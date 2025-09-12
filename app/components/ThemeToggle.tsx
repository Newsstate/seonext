'use client';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', useDark);
    setDark(useDark);
    setReady(true);
  }, []);

  if (!ready) return <div className="btn-ghost px-2 py-2 rounded-lg w-[42px] h-[36px]" />;

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button className="btn-ghost" onClick={toggle} aria-label="Toggle theme">
      {dark ? '🌙' : '☀️'}
    </button>
  );
}
