'use client';

import { useState } from 'react';

export default function SubmitPage() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [prUrl, setPrUrl] = useState('');
  const [msg, setMsg] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending');
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get('name'),
      url: form.get('url'),
      description: form.get('description'),
      category: form.get('category'),
      rail: form.get('rail'),
      pricing_model: form.get('pricing_model'),
      contact: form.get('contact'),
      turnstileToken: form.get('cf-turnstile-response') ?? 'dev',
    };
    try {
      const res = await fetch('/.netlify/functions/submit-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { pr_url?: string; error?: string };
      if (!res.ok) {
        setMsg(body.error ?? `Submission failed (${res.status})`);
        setState('error');
        return;
      }
      setPrUrl(body.pr_url ?? '');
      setState('done');
    } catch {
      setMsg('Network error. Try again.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div>
        <h1>Submitted</h1>
        <p className="lede">
          A pull request was opened for review. New entries land at Tier 1 until verified.
        </p>
        {prUrl && (
          <p>
            <a href={prUrl} target="_blank" rel="noreferrer">
              {prUrl}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1>Submit a merchant</h1>
      <p className="lede">
        Sell products, services, APIs, or content and accept Lightning, BOLT12, L402, or USDT?
        Submit below. Entries are reviewed and land at Tier 1 (self-attested) until verified.
      </p>
      <form className="formgrid" onSubmit={onSubmit}>
        <label>
          Merchant name
          <input name="name" type="text" required />
        </label>
        <label>
          Commerce URL
          <input name="url" type="url" required placeholder="https://" />
        </label>
        <label>
          One-sentence description
          <input name="description" type="text" required />
        </label>
        <label>
          Category
          <select name="category" required defaultValue="">
            <option value="" disabled>
              choose…
            </option>
            <option value="gift-cards">Gift cards & top-ups</option>
            <option value="travel">Travel</option>
            <option value="vpn-privacy">VPN & privacy</option>
            <option value="hosting-domains">Hosting & domains</option>
            <option value="physical-goods">Physical goods</option>
            <option value="content-creator">Content & creator</option>
            <option value="marketplace">Marketplace</option>
            <option value="compute">Compute</option>
            <option value="communication">Communication</option>
            <option value="payment-network">Payment network</option>
            <option value="concierge">Concierge</option>
            <option value="gaming">Gaming</option>
          </select>
        </label>
        <label>
          Primary rail
          <select name="rail" required defaultValue="">
            <option value="" disabled>
              choose…
            </option>
            <option value="lightning">Lightning</option>
            <option value="bolt12">BOLT12</option>
            <option value="l402">L402</option>
            <option value="usdt">USDT</option>
          </select>
        </label>
        <label>
          Pricing model
          <select name="pricing_model" required defaultValue="per-product">
            <option value="subscription">subscription</option>
            <option value="per-product">per-product</option>
            <option value="per-request">per-request</option>
            <option value="variable">variable</option>
            <option value="free">free</option>
          </select>
        </label>
        <label>
          Contact (optional)
          <input name="contact" type="text" />
        </label>
        <button type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Submitting…' : 'Submit for review'}
        </button>
        {state === 'error' && <span className="health-down">{msg}</span>}
      </form>
    </div>
  );
}
