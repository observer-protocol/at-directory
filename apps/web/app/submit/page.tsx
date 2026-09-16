'use client';

import { useEffect } from 'react';

// Swap TALLY_FORM_ID when Boyd creates the form at tally.so.
// URL will be: https://tally.so/r/<TALLY_FORM_ID>
//
// While this is 'TODO' there is no form on this page and nothing reaches
// apps/web/netlify/functions/submit-merchant.ts. That is fine as long as
// nothing elsewhere claims the form is the submission route. It did: the
// README, CONTRIBUTING.md and the directory-expansion open call all named
// the form until 2026-09-15, and an inbound bounty submission found the
// gap and used the merchant inbox instead. Before setting this ID, make a
// test submission and confirm it opens a PR. Advertising the route is the
// last step, not the first.
const TALLY_FORM_ID = 'TODO';

declare global {
  interface Window {
    Tally?: { loadEmbeds: () => void };
  }
}

function TallyEmbed({ formId }: { formId: string }) {
  useEffect(() => {
    const src = 'https://tally.so/widgets/embed.js';
    if (window.Tally) {
      window.Tally.loadEmbeds();
      return;
    }
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => window.Tally?.loadEmbeds();
    document.body.appendChild(s);
  }, []);

  return (
    <iframe
      data-tally-src={`https://tally.so/embed/${formId}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`}
      loading="lazy"
      width="100%"
      height="800"
      style={{ border: 'none', marginTop: '1.5rem' }}
      title="AT Directory listing application"
    />
  );
}

export default function SubmitPage() {
  if (TALLY_FORM_ID === 'TODO') {
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
        <p style={{ marginTop: '2rem' }}>
          <strong>
            Send your application to{' '}
            <a href="mailto:merchants@agenticterminal.ai">merchants@agenticterminal.ai</a>.
          </strong>{' '}
          That is the submission route. There is no form on this page yet, and we would rather say
          so than point you at one that does not work. You can also reach us as{' '}
          <a href="https://x.com/Maxibtc2009" target="_blank" rel="noreferrer">
            @Maxibtc2009
          </a>{' '}
          on X.
        </p>
        <p>
          Tell us the provider URL, a page on the merchant&apos;s own site evidencing the crypto
          rail, the category, the rail, and whether an agent can transact programmatically or a
          human has to complete a checkout.
        </p>
        <p>
          Submitting merchants you did not build? We pay for accepted records. Rates, cap and
          adjudication standard are at{' '}
          <a href="/open-calls/directory-expansion/">Directory Expansion Research</a>.
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
      <TallyEmbed formId={TALLY_FORM_ID} />
    </div>
  );
}
