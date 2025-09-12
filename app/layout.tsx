import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ThemeToggle from './components/ThemeToggle';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SEO Magic',
  description: 'Technical SEO Audits, Indexing & Performance',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <header className="sticky top-0 z-30 border-b border-[rgb(var(--border))] backdrop-blur bg-[rgb(var(--bg))]/80">
          <div className="container-pro py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-6 rounded-xl bg-[rgb(var(--brand))]" />
              <div className="font-semibold tracking-tight">SEO Magic</div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://vercel.com/new/clone?repository-url="
                target="_blank" rel="noreferrer"
                className="btn-ghost"
              >
                Deploy on Vercel →
              </a>
              <ThemeToggle />
              <small className="text-xs text-[rgb(var(--muted))]">
                build {process.env.NEXT_PUBLIC_COMMIT_SHA || 'local'}
              </small>
            </div>
          </div>
        </header>

        <main className="container-pro py-6 space-y-6">{children}</main>
      </body>
    </html>
  );
}
