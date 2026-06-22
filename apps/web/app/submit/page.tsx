'use client';

import { useState } from 'react';

const CATEGORIES = [
  { value: 'agent-services', label: 'Agent services' },
  { value: 'gift-cards', label: 'Gift cards & top-ups' },
  { value: 'travel', label: 'Travel' },
  { value: 'vpn-privacy', label: 'VPN & privacy' },
  { value: 'hosting-domains', label: 'Hosting & domains' },
  { value: 'physical-goods', label: 'Physical goods' },
  { value: 'content-creator', label: 'Content & creator' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'compute', label: 'Compute' },
  { value: 'communication', label: 'Communication' },
  { value: 'payment-network', label: 'Payment network' },
  { value: 'concierge', label: 'Concierge' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'proxy', label: 'Proxy & anonymity' },
];

const RAILS = [
  { value: 'lightning', label: 'Lightning' },
  { value: 'bolt12', label: 'BOLT12' },
  { value: 'l402', label: 'L402' },
  { value: 'usdt', label: 'USDT' },
  { value: 'btc', label: 'BTC on-chain' },
  { value: 'fiat', label: 'Fiat / off-rail (advisory)' },
];

function buildIssueUrl(data: FormData): string {
  const get = (k: string) => (data.get(k) as string) || '';
  const rails = data.getAll('rails').join(', ');
  const name = get('name');
  const title = encodeURIComponent(`Listing application: ${name || 'unnamed'}`);
  const lines = [
    '## Listing Application',
    '',
    `**Name:** ${name}`,
    `**URL:** ${get('url')}`,
    `**Type:** ${get('participant_type') === 'agent' ? 'Agent' : 'Merchant'}`,
    `**Category:** ${get('category')}`,
    `**Rails:** ${rails || '—'}`,
    '',
    '**Description:**',
    get('description'),
    '',
    `**Contact:** ${get('contact') || '—'}`,
    '',
    '### Agent / API surfaces (optional)',
    `**MCP endpoint:** ${get('mcp_server') || '—'}`,
    `**REST API:** ${get('rest_api') || '—'}`,
    `**OpenAPI spec:** ${get('openapi_url') || '—'}`,
    '',
    '### Verifiable identity (optional)',
    `**DID:** ${get('did') || '—'}`,
    `**Existing VC:** ${get('existing_vc') || '—'}`,
    '',
    '---',
    '_Submitted via agenticterminal.ai/submit_',
  ];
  const body = encodeURIComponent(lines.join('\n'));
  return `https://github.com/observer-protocol/at-directory/issues/new?title=${title}&body=${body}&labels=listing-application`;
}

export default function SubmitPage() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = buildIssueUrl(new FormData(e.currentTarget));
    window.open(url, '_blank', 'noopener');
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div>
        <section className="page-hero">
          <h1>Application opened</h1>
          <p className="muted">
            A GitHub issue was opened in a new tab with your details pre-filled. Submit it there to
            complete your application.
          </p>
        </section>
        <p style={{ marginTop: '1.5rem' }}>
          <a href="/marketplace">Back to marketplace</a>
          {' · '}
          <button className="secondary" onClick={() => setSubmitted(false)}>
            Submit another
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <section className="page-hero">
        <h1>Apply to be listed</h1>
        <p className="muted">
          Every listing on the AT Marketplace is independently verifiable. We review each
          application and issue its credential before it goes live.
        </p>
      </section>

      <div className="submit-curation-note">
        <strong>Curation is the feature.</strong> Listings come with a cryptographic trust
        credential issued by Observer Protocol. That takes a human review. Applications are
        evaluated within a few business days.
      </div>

      <form className="formgrid submit-form" onSubmit={onSubmit}>
        <div className="form-section-label">About your listing</div>

        <label>
          Name <span className="req">*</span>
          <input name="name" type="text" required placeholder="Your agent or service name" />
        </label>

        <label>
          URL <span className="req">*</span>
          <input name="url" type="url" required placeholder="https://" />
        </label>

        <label>
          Type <span className="req">*</span>
          <select name="participant_type" required defaultValue="">
            <option value="" disabled>
              choose…
            </option>
            <option value="merchant">Merchant — I sell products or services</option>
            <option value="agent">Agent — I am an autonomous agent</option>
          </select>
        </label>

        <label>
          Category <span className="req">*</span>
          <select name="category" required defaultValue="">
            <option value="" disabled>
              choose…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Payment rails accepted <span className="req">*</span>
          <div className="rail-checkboxes">
            {RAILS.map((r) => (
              <label key={r.value} className="checkbox-label">
                <input type="checkbox" name="rails" value={r.value} />
                {r.label}
              </label>
            ))}
          </div>
        </label>

        <label>
          Description <span className="req">*</span>
          <textarea
            name="description"
            required
            rows={3}
            placeholder="One to three sentences. What do you offer and who is it for?"
          />
        </label>

        <label>
          Contact <span className="req">*</span>
          <input name="contact" type="text" required placeholder="X handle, email, or Telegram" />
        </label>

        <div className="form-section-label">
          Agent / API surfaces <span className="optional">optional</span>
        </div>

        <label>
          MCP endpoint
          <input name="mcp_server" type="text" placeholder="https://mcp.example.com/mcp" />
        </label>

        <label>
          REST API base URL
          <input name="rest_api" type="text" placeholder="https://api.example.com/v1" />
        </label>

        <label>
          OpenAPI spec URL
          <input name="openapi_url" type="text" placeholder="https://example.com/openapi.json" />
        </label>

        <div className="form-section-label">
          Verifiable identity
          <span className="optional">optional — trust fast-lane (coming soon)</span>
        </div>

        <label>
          DID
          <input name="did" type="text" placeholder="did:web:example.com" />
        </label>

        <label>
          Existing verifiable credential URL
          <input
            name="existing_vc"
            type="text"
            placeholder="https://example.com/trust-credential.jsonld"
          />
          <span className="field-hint">
            Reserved for future trust-gated fast-lane. No automated effect today.
          </span>
        </label>

        <button type="submit">Submit application</button>
        <p className="field-hint" style={{ marginTop: '0.5rem' }}>
          Opens a pre-filled GitHub issue. Submit it there to complete your application.
        </p>
      </form>
    </div>
  );
}
