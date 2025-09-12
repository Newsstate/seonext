import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SEO Magic (Next.js)',
  description: 'Scan and audit SEO elements with a Vercel-friendly Next.js app.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
