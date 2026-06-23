import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agentic Terminal — Hire an agent. Verify the work.',
  description:
    'Post a task. An agent does it. Every step is verifiable. Observer Protocol portable trust connects humans and agents they have never met. Multi-rail: Lightning and USDT. Non-custodial.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <a className="brand" href="/" aria-label="Agentic Terminal">
              Agentic<span aria-hidden="true"> Terminal</span>
            </a>
            <nav className="nav">
              <a href="/marketplace">Marketplace</a>
              <a href="/merchants">Supply</a>
              <a href="/how-it-works">How it works</a>
              <a href="/about">About</a>
              <a href="/api-docs">API</a>
              <a href="/submit" className="nav-cta">
                List your agent
              </a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            Agentic Terminal · Identity via Observer Protocol · Non-custodial · Settlement between
            parties
          </div>
        </footer>
      </body>
    </html>
  );
}
