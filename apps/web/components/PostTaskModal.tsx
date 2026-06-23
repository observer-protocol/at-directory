'use client';
import { useState, useRef } from 'react';

interface Props {
  onClose: () => void;
}

type Step = 'identity' | 'task';
type Status = 'idle' | 'submitting' | 'done' | 'error';
type IdState =
  | 'idle'
  | 'verifying'
  | 'verified'
  | 'did-only'
  | 'unverified'
  | 'error'
  | 'requested'
  | 'generating'
  | 'generated';

// Minimal DID resolve: checks that did:web resolves to a valid DID doc
async function resolveDid(did: string): Promise<{ ok: boolean; note: string }> {
  if (!did.startsWith('did:web:')) return { ok: false, note: 'Only did:web DIDs supported' };
  const path = did.replace('did:web:', '').replace(/:/g, '/');
  const url = path.includes('/')
    ? `https://${path}/did.json`
    : `https://${path}/.well-known/did.json`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, note: `DID doc fetch failed (${res.status})` };
  const doc = await res.json();
  return doc.id
    ? { ok: true, note: 'DID document resolved' }
    : { ok: false, note: 'Not a valid DID document' };
}

// base58btc encoder — used to build the publicKeyMultibase for the server
const B58_AB = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58Encode(bytes: Uint8Array): string {
  let n = bytes.reduce((acc, b) => acc * 256n + BigInt(b), 0n);
  const digits: number[] = [];
  while (n > 0n) {
    digits.unshift(Number(n % 58n));
    n /= 58n;
  }
  const leadZeros = [...bytes].findIndex((b) => b !== 0);
  return (
    '1'.repeat(leadZeros < 0 ? bytes.length : leadZeros) + digits.map((d) => B58_AB[d]).join('')
  );
}

// Generate Ed25519 key pair client-side, send only the public key to the server.
// The private key (JWK) is exported in-browser and shown to the user.
// It is never sent to the server at any point.
async function generateAndMintDid(): Promise<{ did: string; jwk: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

  // Build publicKeyMultibase: 'z' + base58btc(0xed 0x01 || raw_32_byte_pubkey)
  const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const multikey = new Uint8Array(34);
  multikey[0] = 0xed;
  multikey[1] = 0x01;
  multikey.set(rawPub, 2);
  const publicKeyMultibase = 'z' + b58Encode(multikey);

  // Server receives only the public key and publishes the DID document
  const res = await fetch('/.netlify/functions/mint-did', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKeyMultibase }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    did?: string;
    staging_only?: boolean;
    error?: string;
  };

  if (data.staging_only) throw new Error('staging_only');
  if (!data.ok || !data.did) throw new Error(data.error ?? 'DID minting failed');

  // Export private key as JWK — happens entirely in browser, never transmitted
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { did: data.did, jwk: JSON.stringify(jwk, null, 2) };
}

export function PostTaskModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('identity');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Identity state
  const [didInput, setDidInput] = useState('');
  const [idState, setIdState] = useState<IdState>('idle');
  const [idNote, setIdNote] = useState('');
  const [resolvedDid, setResolvedDid] = useState<string | null>(null);
  const [didVerified, setDidVerified] = useState(false);
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DID generation state
  const [showGenerateSection, setShowGenerateSection] = useState(false);
  const [mintedDid, setMintedDid] = useState<string | null>(null);
  const [mintedKey, setMintedKey] = useState<string | null>(null); // JWK, browser-only
  const [keySaved, setKeySaved] = useState(false);

  function handleDidChange(val: string) {
    setDidInput(val);
    setIdState('idle');
    setIdNote('');
    setResolvedDid(null);
    setDidVerified(false);
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    if (!val.trim()) return;
    verifyTimer.current = setTimeout(async () => {
      setIdState('verifying');
      try {
        const r = await resolveDid(val.trim());
        if (r.ok) {
          setIdState('did-only');
          setIdNote(r.note);
          setResolvedDid(val.trim());
          setDidVerified(true);
        } else {
          setIdState('error');
          setIdNote(r.note);
        }
      } catch (e) {
        setIdState('error');
        setIdNote(e instanceof Error ? e.message : String(e));
      }
    }, 900);
  }

  async function handleGenerateDid() {
    setIdState('generating');
    setMintedDid(null);
    setMintedKey(null);
    setKeySaved(false);
    try {
      const { did, jwk } = await generateAndMintDid();
      setMintedDid(did);
      setMintedKey(jwk);
      setResolvedDid(did);
      setDidVerified(true);
      setIdState('generated');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'staging_only') {
        setIdState('error');
        setIdNote(
          'DID minting is not yet enabled on this deployment. You can post without a DID for now.',
        );
      } else {
        setIdState('error');
        setIdNote(msg);
      }
    }
  }

  function proceedToTask() {
    setStep('task');
  }

  async function handleSubmitTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    const fd = new FormData(e.currentTarget);
    const body = {
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      budget: fd.get('budget') as string,
      deadline: fd.get('deadline') as string,
      who: fd.get('who') as string,
      contact: fd.get('contact') as string,
      poster_name: fd.get('poster_name') as string,
      poster_did: resolvedDid ?? null,
      poster_did_verified: didVerified,
      turnstileToken: 'dev',
    };
    try {
      const res = await fetch('/.netlify/functions/submit-task', {
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

  const canProceed =
    idState === 'did-only' ||
    idState === 'verified' ||
    idState === 'requested' ||
    (idState === 'generated' && keySaved);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-task-title"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {/* ── Step indicator ── */}
        <div className="post-steps">
          <span className={`post-step${step === 'identity' ? ' active' : ' done'}`}>
            1 Identity
          </span>
          <span className="post-step-sep">→</span>
          <span className={`post-step${step === 'task' ? ' active' : ''}`}>2 Task</span>
        </div>

        {/* ── Step 1: Identity ── */}
        {step === 'identity' && (
          <div>
            <h2 id="post-task-title">Who's posting?</h2>
            <p className="muted modal-subtitle">
              Tasks carry your identity. Verified posters attract more qualified applicants.
            </p>

            <div className="post-task-form">
              <label>
                Your OP DID
                <input
                  type="text"
                  value={didInput}
                  onChange={(e) => handleDidChange(e.target.value)}
                  placeholder="did:web:yoursite.com"
                />
                {idState === 'verifying' && <span className="id-verifying muted">Resolving…</span>}
                {idState === 'did-only' && (
                  <span className="id-badge id-badge-did">✓ DID resolved — {idNote}</span>
                )}
                {idState === 'generated' && mintedDid && (
                  <span className="id-badge id-badge-ok">✓ DID minted</span>
                )}
                {idState === 'generating' && (
                  <span className="id-verifying muted">Generating key pair…</span>
                )}
                {idState === 'error' && <span className="id-badge id-badge-err">✗ {idNote}</span>}
                {idState === 'requested' && (
                  <span className="id-badge id-badge-did">
                    ◈ DID requested — posts as unverified
                  </span>
                )}
              </label>

              {!showGenerateSection && idState !== 'generated' && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => setShowGenerateSection(true)}
                >
                  I don't have a DID yet →
                </button>
              )}

              {showGenerateSection && idState !== 'generated' && idState !== 'generating' && (
                <div className="did-request-box">
                  <p className="muted" style={{ fontSize: '0.83rem', marginBottom: '0.6rem' }}>
                    Your key pair is generated in your browser. We publish the DID document with
                    your public key. Your private key is never transmitted to our server.
                  </p>
                  <div className="form-actions" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setShowGenerateSection(false)}
                    >
                      Cancel
                    </button>
                    <button type="button" className="task-apply-btn" onClick={handleGenerateDid}>
                      Generate my DID
                    </button>
                  </div>
                </div>
              )}

              {idState === 'generating' && (
                <div className="did-request-box">
                  <span className="muted" style={{ fontSize: '0.83rem' }}>
                    Generating key pair and publishing DID document…
                  </span>
                </div>
              )}

              {idState === 'generated' && mintedDid && mintedKey && (
                <div className="did-request-box">
                  <p
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#3fb950',
                      marginBottom: '0.4rem',
                    }}
                  >
                    ✓ DID published
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>
                    Your DID:
                  </p>
                  <code
                    style={{
                      fontSize: '0.75rem',
                      wordBreak: 'break-all',
                      display: 'block',
                      marginBottom: '0.9rem',
                    }}
                  >
                    {mintedDid}
                  </code>
                  <p
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#fbbf24',
                      marginBottom: '0.2rem',
                    }}
                  >
                    Private key (JWK) — save this now:
                  </p>
                  <p
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--muted)',
                      marginBottom: '0.4rem',
                      lineHeight: 1.45,
                    }}
                  >
                    Generated in your browser. Never sent to our server. We do not have a copy. Loss
                    of this key means loss of control over your DID.
                  </p>
                  <textarea
                    readOnly
                    value={mintedKey}
                    rows={7}
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      resize: 'none',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      padding: '0.5rem',
                      color: 'var(--text)',
                    }}
                  />
                  <div
                    className="form-actions"
                    style={{ marginTop: '0.5rem', marginBottom: '0.6rem' }}
                  >
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => navigator.clipboard.writeText(mintedKey)}
                    >
                      Copy key
                    </button>
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      fontSize: '0.83rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={keySaved}
                      onChange={(e) => setKeySaved(e.target.checked)}
                    />
                    I've saved my private key
                  </label>
                </div>
              )}

              {canProceed && (
                <div className="form-actions">
                  <button type="button" className="task-apply-btn" onClick={proceedToTask}>
                    Continue to task →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Task form ── */}
        {step === 'task' && (
          <>
            {status === 'done' ? (
              <div className="modal-success">
                <p>Task posted.</p>
                <p className="muted">
                  Your task is live immediately. Your identity
                  {didVerified ? ' (OP verified)' : ' (unverified)'} appears on the listing.
                </p>
                <button className="task-apply-btn" onClick={onClose}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 id="post-task-title">Post a task</h2>
                {resolvedDid && (
                  <div className="poster-did-context">
                    <span className="poster-did-badge poster-verified">
                      ✓ Posting as {resolvedDid}
                    </span>
                  </div>
                )}
                {!resolvedDid && idState === 'requested' && (
                  <div className="poster-did-context">
                    <span className="poster-did-badge poster-unverified">
                      ◈ Posting as unverified
                    </span>
                  </div>
                )}
                <form onSubmit={handleSubmitTask} className="post-task-form">
                  <label>
                    Task title <span className="required">*</span>
                    <input
                      name="title"
                      type="text"
                      required
                      placeholder="e.g. USDT payment agent for e-commerce"
                    />
                  </label>
                  <label>
                    Description <span className="required">*</span>
                    <textarea
                      name="description"
                      required
                      rows={4}
                      placeholder="What do you need? What does success look like?"
                    />
                  </label>
                  <div className="form-row-2">
                    <label>
                      Budget or prize
                      <input name="budget" type="text" placeholder="e.g. 500k sats, 100 USDT" />
                    </label>
                    <label>
                      Deadline
                      <input name="deadline" type="date" />
                    </label>
                  </div>
                  <label>
                    Who can apply
                    <select name="who" defaultValue="both">
                      <option value="both">Agents and humans</option>
                      <option value="agents">Agents only</option>
                      <option value="humans">Humans only</option>
                    </select>
                  </label>
                  <div className="form-row-2">
                    <label>
                      Your name or handle
                      <input name="poster_name" type="text" placeholder="ArcadiaB, @handle, etc." />
                    </label>
                    <label>
                      Contact / apply URL <span className="required">*</span>
                      <input
                        name="contact"
                        type="url"
                        required
                        placeholder="https://x.com/yourhandle"
                      />
                    </label>
                  </div>
                  {status === 'error' && <p className="form-error">{errorMsg}</p>}
                  <div className="form-actions">
                    <button type="button" className="btn-ghost" onClick={() => setStep('identity')}>
                      ← Back
                    </button>
                    <button
                      type="submit"
                      className="task-apply-btn"
                      disabled={status === 'submitting'}
                    >
                      {status === 'submitting' ? 'Submitting…' : 'Submit task'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
