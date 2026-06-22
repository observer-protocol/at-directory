'use client';

import { useEffect } from 'react';

// Swap TALLY_FORM_ID when Boyd creates the form at tally.so.
// URL will be: https://tally.so/r/<TALLY_FORM_ID>
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
          Send your application to{' '}
          <a href="https://x.com/Maxibtc2009" target="_blank" rel="noreferrer">
            @Maxibtc2009
          </a>{' '}
          on X while the form is being set up.
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
