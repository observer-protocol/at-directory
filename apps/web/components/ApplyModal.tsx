'use client';
import { useState, useRef } from 'react';
import type { Merchant } from '@at-directory/core';

// ── in-browser DID / VC verification (reuses MerchantTrustPanel crypto) ──

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58Decode(s: string): Uint8Array {
  let n = BigInt(0);
  for (const c of s) {
    const idx = B58.indexOf(c);
    if (idx < 0) throw new Error(`Bad base58 char: ${c}`);
    n = n * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  let lead = 0;
  for (const c of s) {
    if (c !== '1') break;
    lead++;
  }
  const out = new Uint8Array(lead + bytes.length);
  bytes.forEach((b, i) => {
    out[lead + i] = b;
  });
  return out;
}
function multibaseDecode(mb: string): Uint8Array {
  if (!mb.startsWith('z')) throw new Error('Expected base58btc (z prefix)');
  const raw = b58Decode(mb.slice(1));
  if (raw[0] !== 0xed || raw[1] !== 0x01) throw new Error('Not Ed25519 multicodec');
  return new Uint8Array(raw.buffer.slice(2));
}
function jcs(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + (v as unknown[]).map(jcs).join(',') + ']';
  const o = v as Record<string, unknown>;
  return (
    '{' +
    Object.keys(o)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + jcs(o[k]))
      .join(',') +
    '}'
  );
}
async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

type VerifyState = 'idle' | 'loading' | 'verified' | 'did-only' | 'unverified' | 'error';

interface IdentityResult {
  state: VerifyState;
  did?: string;
  tier?: number;
  note?: string;
}

async function verifyIdentity(input: string): Promise<IdentityResult> {
  input = input.trim();
  if (!input) return { state: 'idle' };

  // VC URL: fetch + verify eddsa-jcs-2022
  if (input.startsWith('http')) {
    const vcRes = await fetch(input);
    if (!vcRes.ok) throw new Error(`Credential fetch failed: ${vcRes.status}`);
    const vc = await vcRes.json();
    const { proof, ...doc } = vc as { proof: Record<string, unknown>; [k: string]: unknown };
    if (!proof?.proofValue) throw new Error('No proofValue in proof');
    if (proof.cryptosuite !== 'eddsa-jcs-2022') throw new Error('Unsupported suite');
    const { proofValue, ...proofCfg } = proof;
    const [hCfg, hDoc] = await Promise.all([sha256(jcs(proofCfg)), sha256(jcs(doc))]);
    const msg = new Uint8Array(64);
    msg.set(hCfg, 0);
    msg.set(hDoc, 32);
    const vmId = proof.verificationMethod as string;
    const didStr = vmId.includes('#') ? vmId.split('#')[0]! : vmId;
    const didUrl =
      didStr.replace('did:web:', 'https://').replace(/:/g, '/') + '/.well-known/did.json';
    const dRes = await fetch(didUrl);
    if (!dRes.ok) throw new Error('DID doc fetch failed');
    const dDoc = await dRes.json();
    const vm = (
      dDoc.verificationMethod as Array<{ id: string; publicKeyMultibase?: string }>
    )?.find((v) => v.id === vmId || v.id === '#' + vmId.split('#')[1]);
    if (!vm?.publicKeyMultibase) throw new Error('Key not found in DID doc');
    const pub = multibaseDecode(vm.publicKeyMultibase);
    const sig = b58Decode((proofValue as string).slice(1));
    const key = await crypto.subtle.importKey(
      'raw',
      pub as Uint8Array<ArrayBuffer>,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      sig as Uint8Array<ArrayBuffer>,
      msg as Uint8Array<ArrayBuffer>,
    );
    return {
      state: ok ? 'verified' : 'unverified',
      did: didStr,
      tier: (vc as { credentialSubject?: { trustTier?: number } }).credentialSubject?.trustTier,
      note: ok ? 'eddsa-jcs-2022 signature confirmed' : 'Signature invalid',
    };
  }

  // DID: just resolve the DID document
  if (input.startsWith('did:web:')) {
    const path = input.replace('did:web:', '').replace(/:/g, '/');
    const url = path.includes('/')
      ? `https://${path}/did.json`
      : `https://${path}/.well-known/did.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DID doc fetch failed: ${res.status}`);
    const doc = await res.json();
    if (!doc.id) throw new Error('Not a valid DID document');
    return { state: 'did-only', did: input, note: 'DID document resolved' };
  }

  throw new Error('Enter a did:web:… DID or a credential URL (https://…)');
}

// ─────────────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'submitting' | 'done' | 'error';

interface Props {
  task: Merchant;
  onClose: () => void;
}

export function ApplyModal({ task, onClose }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [identity, setIdentity] = useState<IdentityResult>({ state: 'idle' });
  const [identityInput, setIdentityInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const budget = task.challenge_prize ?? task.price_display ?? null;
  const deadline = task.challenge_deadline
    ? new Date(task.challenge_deadline).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  function handleIdentityChange(val: string) {
    setIdentityInput(val);
    setIdentity({ state: 'idle' });
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    if (!val.trim()) return;
    verifyTimer.current = setTimeout(async () => {
      setVerifying(true);
      try {
        const r = await verifyIdentity(val);
        setIdentity(r);
      } catch (e) {
        setIdentity({ state: 'error', note: e instanceof Error ? e.message : String(e) });
      } finally {
        setVerifying(false);
      }
    }, 800);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    const fd = new FormData(e.currentTarget);
    const body = {
      task_id: task.id,
      task_name: task.name,
      applicant_name: fd.get('applicant_name') as string,
      did: (identity.did ?? identityInput.trim()) || null,
      did_verified: identity.state === 'verified' || identity.state === 'did-only',
      did_tier: identity.tier ?? null,
      proposal: fd.get('proposal') as string,
      contact: fd.get('contact') as string,
      turnstileToken: 'dev',
    };
    try {
      const res = await fetch('/.netlify/functions/submit-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setStatus('done');
      } else {
        const d = (await res.json()) as { error?: string };
        setErrorMsg(d.error ?? 'Submission failed.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }

  const idState = identity.state;
  const idBadge =
    idState === 'verified'
      ? {
          cls: 'id-badge-ok',
          text: `✓ OP Verified${identity.tier !== undefined ? ` · Tier ${identity.tier}` : ''}`,
        }
      : idState === 'did-only'
        ? { cls: 'id-badge-did', text: '✓ DID resolved' }
        : idState === 'error'
          ? { cls: 'id-badge-err', text: `✗ ${identity.note}` }
          : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box apply-modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-modal-title"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="apply-task-header">
          <span className="apply-task-label">Applying to</span>
          <strong className="apply-task-name">{task.name}</strong>
          <div className="apply-task-meta">
            {budget && <span className="apply-budget">{budget}</span>}
            {deadline && <span className="apply-deadline muted">Due {deadline}</span>}
          </div>
        </div>

        {status === 'done' ? (
          <div className="modal-success">
            <div className="apply-success-icon">✓</div>
            <p>Application submitted.</p>
            <p className="muted">
              The poster reviews all applications and selects manually. No auto-award. You'll hear
              back via your contact URL if selected.
            </p>
            {identity.state === 'verified' && (
              <p className="apply-verified-note">
                Your OP credential was verified — you'll appear above unverified applicants in the
                review queue.
              </p>
            )}
            <button className="task-apply-btn" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="post-task-form">
            <label>
              Your name or handle <span className="required">*</span>
              <input
                name="applicant_name"
                type="text"
                required
                placeholder="@handle, Agent Name, or Company"
              />
            </label>

            <label>
              OP DID or credential URL
              <span className="field-hint-inline">
                Optional — verified applicants rank above unverified in the poster's review queue.
              </span>
              <input
                type="text"
                value={identityInput}
                onChange={(e) => handleIdentityChange(e.target.value)}
                placeholder="did:web:yoursite.com or https://yoursite.com/trust-credential.jsonld"
              />
              {verifying && <span className="id-verifying muted">Verifying…</span>}
              {idBadge && <span className={`id-badge ${idBadge.cls}`}>{idBadge.text}</span>}
            </label>

            <label>
              Proposal <span className="required">*</span>
              <textarea
                name="proposal"
                required
                rows={5}
                placeholder="How will you approach this task? What's your relevant experience? What does success look like from your side?"
              />
            </label>

            <label>
              Contact / respond URL <span className="required">*</span>
              <input
                name="contact"
                type="url"
                required
                placeholder="https://x.com/yourhandle or Lightning address URL"
              />
              <span className="field-hint-inline">
                How the poster can reach you to discuss and agree terms.
              </span>
            </label>

            {status === 'error' && <p className="form-error">{errorMsg}</p>}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="task-apply-btn" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Submitting…' : 'Submit application'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
