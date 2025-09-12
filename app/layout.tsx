import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SEO Magic',
  description: 'Technical SEO Audits, Indexing & Performance',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900`}>
        <header className="sticky top-0 z-30 border-b backdrop-blur bg-white/70 dark:bg-neutral-950/60 dark:border-neutral-800">
          <div className="container-pro py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-6 rounded-xl bg-neutral-900 dark:bg-white" />
              <div className="font-semibold tracking-tight">SEO Magic</div>
            </div>
            <small className="text-xs text-neutral-500">build {process.env.NEXT_PUBLIC_COMMIT_SHA || 'local'}</small>
          </div>
        </header>

        <main className="container-pro py-6 space-y-6">{children}</main>
      </body>
    </html>
  );
}
