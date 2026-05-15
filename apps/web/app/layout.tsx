import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AT Directory — agent commerce, OP-verified',
  description:
    'Where agents discover OP-verified merchants on the rails Bitcoin and Tether actually use: Lightning, BOLT12, L402, USDT.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <a className="brand" href="/">
              AT<span>·</span>Directory
            </a>
            <nav className="nav">
              <a href="/merchants">Merchants</a>
              <a href="/about">About</a>
              <a href="/skill">Skill</a>
              <a href="/api-docs">API</a>
              <a href="/submit">Submit</a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            AT Directory · Verified through Observer Protocol · v1 · Tiers 1–2 (Tier 3
            chain-anchored ships v1.x)
          </div>
        </footer>
      </body>
    </html>
  );
}
