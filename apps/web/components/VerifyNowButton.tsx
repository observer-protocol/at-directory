'use client';

import { useState } from 'react';

interface Result {
  status: string;
  detail: string;
  checked_at?: string;
}

export function VerifyNowButton({ merchantId, rail }: { merchantId: string; rail: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setState('loading');
    try {
      const res = await fetch('/.netlify/functions/verify-rail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_id: merchantId, rail }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setResult((await res.json()) as Result);
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <span className="row">
      <button className="secondary" onClick={run} disabled={state === 'loading'}>
        {state === 'loading' ? 'Verifying…' : `Verify ${rail}`}
      </button>
      {state === 'done' && result && (
        <span className={`health-${result.status}`}>
          {result.status} — {result.detail}
        </span>
      )}
      {state === 'error' && <span className="health-unknown">verification unavailable</span>}
    </span>
  );
}
