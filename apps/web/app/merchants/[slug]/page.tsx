import { notFound } from 'next/navigation';
import type { Merchant } from '@at-directory/core';
import { allListings, merchantBySlug, categoryLabel } from '@/lib/data';
import { isOpenCall } from '@/lib/display-policy';
import { TrustTier } from '@/components/TrustTier';
import { RailIcon } from '@/components/RailIcon';
import { VerifyNowButton } from '@/components/VerifyNowButton';

const CALLABLE_LABEL: Record<string, string> = {
  'full-api': 'Full API',
  'structured-handoff': 'Structured handoff',
  'human-checkout': 'Human checkout',
};

const CALL_STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  judging: 'Judging',
  paused: 'Paused',
  closed: 'Closed',
  winner: 'Winner announced',
};

// The task board is suppressed while there are fewer than three live calls
// (lib/display-policy.ts), so for most of this call's life THIS page is the
// only place its terms are published. It has to carry them: budget, closing
// date, status and the link to the full terms, not just the description.
//
// Formatted from the ISO string rather than toLocaleDateString: this is a
// static export and a date that renders differently per locale is a term of
// a bounty that reads differently per reader.
function callDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${
    [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ][d.getUTCMonth()]
  } ${d.getUTCFullYear()}`;
}

// Every listing gets a detail page, not just the merchant directory:
// marketplace task cards link open calls to /merchants/{id}/, so narrowing
// this to allMerchants() would 404 all four of them.
export function generateStaticParams() {
  return allListings().map((m) => ({ slug: m.id }));
}

export default async function MerchantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = merchantBySlug(slug);
  if (!m) notFound();

  return (
    <div>
      <h1>{m.name}</h1>
      <p className="lede">{m.description}</p>
      <div className="row">
        <span className={`badge callable callable-${m.agent_callable_tier}`}>
          {CALLABLE_LABEL[m.agent_callable_tier] ?? m.agent_callable_tier}
        </span>
        <TrustTier
          merchantId={m.id}
          fallbackTier={m.op_trust_tier}
          attestationUrl={m.op_attestation_url}
        />
        <span className="badge">{m.pricing_model}</span>
        {m.accepts_usdc && <span className="badge">+ USDC</span>}
        {m.accepts_x402 && <span className="badge">+ x402</span>}
      </div>

      <p>
        <a href={m.url} target="_blank" rel="noreferrer">
          {m.url}
        </a>{' '}
        · <a href={`/categories/${m.category}/`}>{categoryLabel(m.category)}</a>
      </p>

      {isOpenCall(m) && <OpenCallTerms m={m} />}

      <h2>Rails</h2>
      <table>
        <thead>
          <tr>
            <th>Rail</th>
            <th>Chain</th>
            <th>Health</th>
            <th>Verify</th>
          </tr>
        </thead>
        <tbody>
          {m.rails.map((r, i) => (
            <tr key={i}>
              <td>
                <RailIcon rail={r.rail} />
              </td>
              <td>{r.chain ?? '—'}</td>
              <td className={`health-${r.health}`}>{r.health}</td>
              <td>
                <VerifyNowButton merchantId={m.id} rail={r.rail} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {m.agent_endpoints && (
        <>
          <h2>Agent endpoints</h2>
          <table>
            <tbody>
              {m.agent_endpoints.mcp_server && (
                <tr>
                  <th>MCP server</th>
                  <td>
                    <code>{m.agent_endpoints.mcp_server}</code>
                  </td>
                </tr>
              )}
              {m.agent_endpoints.rest_api && (
                <tr>
                  <th>REST API</th>
                  <td>
                    <code>{m.agent_endpoints.rest_api}</code>
                  </td>
                </tr>
              )}
              {m.agent_endpoints.auth_note && (
                <tr>
                  <th>Auth</th>
                  <td>{m.agent_endpoints.auth_note}</td>
                </tr>
              )}
              {m.agent_endpoints.api_docs && (
                <tr>
                  <th>API docs</th>
                  <td>
                    <a href={m.agent_endpoints.api_docs} target="_blank" rel="noreferrer">
                      {m.agent_endpoints.api_docs}
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      <h2>Query this merchant from an agent</h2>
      <pre className="codeblock">{`get_merchant({ id: "${m.id}" })`}</pre>
    </div>
  );
}

function OpenCallTerms({ m }: { m: Merchant }) {
  const status = m.challenge_status ?? 'open';
  const budget = m.challenge_prize ?? m.price_display ?? null;
  return (
    <section className="open-call-terms">
      <h2>This is an open call</h2>
      <div className="row">
        <span className={`badge challenge-status status-${status}`}>
          {CALL_STATUS_LABEL[status] ?? status}
        </span>
        {budget && <span className="badge">{budget}</span>}
        {m.challenge_deadline && (
          <span className="badge">Closes {callDate(m.challenge_deadline)}</span>
        )}
      </div>
      {status === 'paused' && (
        <p className="notice">
          Paused. Not accepting submissions right now, because the call has reached its budget cap
          for the current period. It reopens at the start of the next one, and nothing about the
          published rates changes in the meantime.
        </p>
      )}
      {m.terms_url && (
        <p>
          <a href={m.terms_url}>
            <strong>Full terms</strong>
          </a>
          : rates, cap, and what counts as accepted. Read these before starting work.
        </p>
      )}
      {m.contact_url && (
        <p>
          Submit to{' '}
          <a href={m.contact_url} target="_blank" rel="noreferrer">
            {m.contact_url.replace(/^mailto:/, '')}
          </a>
          .
        </p>
      )}
    </section>
  );
}
