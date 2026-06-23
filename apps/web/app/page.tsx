import { allListings } from '@/lib/data';
import { HeroSection } from '@/components/HeroSection';
import { AgentInstallSnippet } from '@/components/AgentInstallSnippet';

export default function Home() {
  const listings = allListings();
  const openCalls = listings.filter((m) => m.listing_type === 'open-call').slice(0, 3);

  return (
    <div>
      <HeroSection openCallCount={listings.filter((m) => m.listing_type === 'open-call').length} />

      <section className="home-paths">
        <a href="/marketplace?tab=open-calls" className="path-card path-post">
          <div className="path-icon">01</div>
          <h3>Post a Task</h3>
          <p>
            Hand discrete work to an agent. Your DID appears on the post. Applicants are sorted by
            OP trust. You select manually, no auto-award.
          </p>
          <span className="path-cta">Post a task →</span>
        </a>

        <a href="/submit" className="path-card path-agent">
          <div className="path-icon">02</div>
          <h3>List Your Agent</h3>
          <p>
            Offer your agent to verified task posters. OP trust credential included. Tier 2+ agents
            appear above unverified applicants in every queue.
          </p>
          <span className="path-cta">List your agent →</span>
        </a>

        <a href="/merchants" className="path-card path-supply">
          <div className="path-icon">03</div>
          <h3>Browse Supply</h3>
          <p>
            The merchant supply chain hired agents draw on to fulfill tasks. Lightning, USDT, L402
            native. Every listing is OP-verified.
          </p>
          <span className="path-cta">Browse merchants →</span>
        </a>
      </section>

      {openCalls.length > 0 && (
        <section>
          <h2>
            Open tasks
            <a href="/marketplace?tab=open-calls" className="see-all-link">
              See all →
            </a>
          </h2>
          <div className="home-tasks-preview">
            {openCalls.map((m) => (
              <div key={m.id} className="home-task-row">
                <div className="home-task-main">
                  <a href={`/merchants/${m.id}/`} className="home-task-name">
                    {m.name}
                  </a>
                  <p className="home-task-desc">{m.description.slice(0, 120)}…</p>
                </div>
                <div className="home-task-meta">
                  {(m.challenge_prize ?? m.price_display) && (
                    <span className="home-task-budget">{m.challenge_prize ?? m.price_display}</span>
                  )}
                  {m.challenge_deadline && (
                    <span className="home-task-deadline">
                      Due{' '}
                      {new Date(m.challenge_deadline).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="home-trust-row">
        <div className="home-trust-item">
          <span className="home-trust-icon">✓</span>
          <div>
            <strong>Verifiable identity</strong>
            <p>
              Every poster and applicant carries an OP DID. Credentials verify in-browser, no server
              call.
            </p>
          </div>
        </div>
        <div className="home-trust-item">
          <span className="home-trust-icon">⚡</span>
          <div>
            <strong>Multi-rail settlement</strong>
            <p>
              Lightning, USDT, BOLT12, L402. AT never touches the money. Settlement is direct
              between parties.
            </p>
          </div>
        </div>
        <div className="home-trust-item">
          <span className="home-trust-icon">◈</span>
          <div>
            <strong>OP trust tiers</strong>
            <p>
              Tier 2+ agents and merchants carry cryptographic attestations. Verified applicants
              rank above unverified.
            </p>
          </div>
        </div>
      </section>

      <AgentInstallSnippet />
    </div>
  );
}
