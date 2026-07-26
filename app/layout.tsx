import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono, Pacifico } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

// Used only for the "XOXO" brand wordmark, to echo the script-style logo.
const pacifico = Pacifico({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-script',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Xoxostore — Returns & Exchanges',
  description: 'Internal returns, exchanges, replacements & reverse pickup tracker for Xoxostore',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable} ${pacifico.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
