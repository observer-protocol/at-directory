import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AT Directory — Agentic Commerce Merchant Directory for Lightning, USDT, and Crypto Rails',
  description:
    'AT Directory is the open agentic commerce merchant directory where autonomous agents discover merchants accepting Lightning, BOLT12, L402, and USDT — with cryptographic trust attestations issued through Observer Protocol. Verifiable, protocol-agnostic, free of platform capture.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <a className="brand" href="/" aria-label="AT Directory">
              AT<span aria-hidden="true">·</span>Directory
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
            AT Directory · Verified through Observer Protocol · v1 · Tier 3 enables when merchants
            natively adopt OP
          </div>
        </footer>
      </body>
    </html>
  );
}
