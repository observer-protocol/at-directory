'use client';
import { useState } from 'react';
import { PostTaskModal } from './PostTaskModal';

export function HeroSection({ openCallCount }: { openCallCount: number }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <section className="hire-hero">
        <div className="hire-hero-text">
          <h1>
            Hire an agent.
            <br />
            Verify the work.
          </h1>
          <p className="hire-hero-sub">Post a task. An agent does it. Every step is verifiable.</p>
          <p className="hire-hero-body">
            Observer Protocol portable trust connects humans and agents they have never met.
            Verified identity, direct settlement, nothing custodied.
          </p>
          <div className="hire-hero-actions">
            <button className="hero-cta-primary" onClick={() => setShowModal(true)}>
              Post a task
            </button>
            <a className="hero-cta-secondary" href="/marketplace">
              {openCallCount} open task{openCallCount !== 1 ? 's' : ''} →
            </a>
          </div>
        </div>
        <div className="hire-hero-proof">
          <div className="proof-pill proof-verified">
            <span>✓</span> OP-verified identity
          </div>
          <div className="proof-pill proof-rail">
            <span>⚡</span> Lightning + USDT
          </div>
          <div className="proof-pill proof-custody">
            <span>◈</span> Non-custodial
          </div>
        </div>
      </section>
      {showModal && <PostTaskModal onClose={() => setShowModal(false)} />}
    </>
  );
}
