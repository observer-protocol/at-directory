'use client';
import { useState, useRef } from 'react';

interface Props {
  onClose: () => void;
}

type Step = 'identity' | 'task';
type Status = 'idle' | 'submitting' | 'done' | 'error';
type IdState = 'idle' | 'verifying' | 'did-only' | 'error' | 'generating' | 'generated';

// ── Ed25519 support detection ────────────────────────────────────────────────
// Cached on first call. Browsers below Chrome 113 / Firefox 119 / Safari 17
// do not support this algorithm; we detect early so we can hide the generate
// button rather than letting it throw.
let _ed25519Check: Promise<boolean> | null = null;
function checkEd25519Support(): Promise<boolean> {
  if (_ed25519Check) return _ed25519Check;
  _ed25519Check = (async () => {
    try {
      if (typeof crypto === 'undefined' || !crypto.subtle?.generateKey) return false;
      await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
      return true;
    } catch {
      return false;
    }
  })();
  return _ed25519Check;
}

// ── DID resolution (existing DID path) ──────────────────────────────────────
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

// ── Client-side keygen (new DID path) ───────────────────────────────────────
// Private key is generated in-browser, exported as JWK, and shown to the
// user. It is never sent to the server. The server receives only the
// publicKeyMultibase and publishes the hosted DID document.
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

async function generateAndMintDid(): Promise<{ did: string; jwk: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

  const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const multikey = new Uint8Array(34);
  multikey[0] = 0xed;
  multikey[1] = 0x01;
  multikey.set(rawPub, 2);
  const publicKeyMultibase = 'z' + b58Encode(multikey);

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

  // Export private key as JWK entirely in-browser — never transmitted
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { did: data.did, jwk: JSON.stringify(jwk, null, 2) };
}

// ────────────────────────────────────────────────────────────────────────────

export function PostTaskModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('identity');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Optional DID section
  const [showDIDSection, setShowDIDSection] = useState(false);
  const [didInput, setDidInput] = useState('');
  const [idState, setIdState] = useState<IdState>('idle');
  const [idNote, setIdNote] = useState('');
  const [resolvedDid, setResolvedDid] = useState<string | null>(null);
  const [didVerified, setDidVerified] = useState(false);
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keygen sub-state
  const [mintedDid, setMintedDid] = useState<string | null>(null);
  const [mintedKey, setMintedKey] = useState<string | null>(null);
  const [keySaved, setKeySaved] = useState(false);
  const [browserSupported, setBrowserSupported] = useState<boolean | null>(null);
  // Generate-specific error — kept separate from DID resolution errors so the
  // generate link and the DID input badge don't bleed into each other.
  const [generateError, setGenerateError] = useState<string | null>(null);

  function openDIDSection() {
    setShowDIDSection(true);
    // Check browser support in background; don't block the UI
    checkEd25519Support().then(setBrowserSupported);
  }

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
    setGenerateError(null);
    const supported = await checkEd25519Support();
    if (!supported) {
      setBrowserSupported(false);
      return;
    }

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
      // Reset idState to idle so the DID input badge stays clean.
      // Generate errors render near the generate link, not in the input badge.
      setIdState('idle');
      const msg = e instanceof Error ? e.message : String(e);
      setGenerateError(msg === 'staging_only' ? 'staging_only' : msg);
    }
  }

  // The keyless human lane: "Continue to task" is always reachable.
  // The DID section is optional enrichment — it only blocks proceed if the
  // user has started keygen and hasn't yet saved their key.
  const midGeneration = idState === 'generating' || (idState === 'generated' && !keySaved);
  const canProceed = !midGeneration;

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
            <h2 id="post-task-title">Post a task</h2>
            <p className="muted modal-subtitle">
              No account needed. Skip ahead to post as unverified, or add a verifiable identity
              below.
            </p>

            {/* ── Optional DID section ── */}
            {!showDIDSection && (
              <button
                type="button"
                className="btn-ghost"
                style={{ alignSelf: 'flex-start', marginBottom: '1rem' }}
                onClick={openDIDSection}
              >
                Add verifiable identity (optional) →
              </button>
            )}

            {showDIDSection && (
              <div className="did-request-box" style={{ marginBottom: '1rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                    Verifiable identity (optional)
                  </span>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}
                    onClick={() => {
                      setShowDIDSection(false);
                      setIdState('idle');
                      setResolvedDid(null);
                      setDidVerified(false);
                      setMintedDid(null);
                      setMintedKey(null);
                      setGenerateError(null);
                    }}
                  >
                    Remove
                  </button>
                </div>

                {/* ── Existing DID input ── */}
                {idState !== 'generating' && idState !== 'generated' && (
                  <div className="post-task-form" style={{ gap: '0.4rem' }}>
                    <label style={{ marginBottom: 0 }}>
                      Your OP DID
                      <input
                        type="text"
                        value={didInput}
                        onChange={(e) => handleDidChange(e.target.value)}
                        placeholder="did:web:yoursite.com"
                      />
                      {idState === 'verifying' && (
                        <span className="id-verifying muted">Resolving…</span>
                      )}
                      {idState === 'did-only' && (
                        <span className="id-badge id-badge-did">✓ DID resolved — {idNote}</span>
                      )}
                      {idState === 'error' && (
                        <span className="id-badge id-badge-err">✗ {idNote}</span>
                      )}
                    </label>

                    {/* ── New DID lane ── */}
                    {browserSupported === false ? (
                      <p
                        style={{ fontSize: '0.78rem', color: 'var(--bad)', margin: '0.25rem 0 0' }}
                      >
                        Browser does not support Ed25519 key generation (Chrome 113+, Firefox 119+,
                        Safari 17+ required).
                      </p>
                    ) : generateError === 'staging_only' ? (
                      <p className="muted" style={{ fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
                        DID minting is not yet enabled on this deployment. You can post without a
                        DID — it shows as unverified.
                      </p>
                    ) : generateError ? (
                      <p style={{ fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
                        <span style={{ color: 'var(--bad)' }}>✗ {generateError}</span>{' '}
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ display: 'inline', padding: 0, fontSize: 'inherit' }}
                          onClick={handleGenerateDid}
                        >
                          Retry →
                        </button>
                      </p>
                    ) : (
                      <p className="muted" style={{ fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
                        No DID yet?{' '}
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ display: 'inline', padding: 0, fontSize: 'inherit' }}
                          onClick={handleGenerateDid}
                        >
                          Generate one in your browser →
                        </button>
                      </p>
                    )}
                  </div>
                )}

                {/* ── Keygen in progress ── */}
                {idState === 'generating' && (
                  <p className="muted" style={{ fontSize: '0.83rem' }}>
                    Generating key pair and publishing DID document…
                  </p>
                )}

                {/* ── Key save step ── */}
                {idState === 'generated' && mintedDid && mintedKey && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    <p
                      style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3fb950', margin: 0 }}
                    >
                      ✓ DID published
                    </p>
                    <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', display: 'block' }}>
                      {mintedDid}
                    </code>

                    <p
                      style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', margin: 0 }}
                    >
                      Save your private key now — this is the only time you can.
                    </p>
                    <p
                      style={{
                        fontSize: '0.74rem',
                        color: 'var(--muted)',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      Generated in your browser. Never transmitted to our server. We have no copy
                      and no recovery mechanism. If you lose this key, your DID is permanently gone
                      — it cannot be reset or recovered by anyone.
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
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => navigator.clipboard.writeText(mintedKey)}
                    >
                      Copy key
                    </button>
                    <label
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'flex-start',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        lineHeight: 1.45,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={keySaved}
                        onChange={(e) => setKeySaved(e.target.checked)}
                        style={{ marginTop: '0.2rem', flexShrink: 0 }}
                      />
                      I have saved my private key. I understand that losing it permanently loses
                      this identity — there is no reset or recovery.
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* ── CTA — always reachable for the human lane ── */}
            <div className="form-actions">
              <button
                type="button"
                className="task-apply-btn"
                disabled={!canProceed}
                onClick={() => setStep('task')}
              >
                {idState === 'generating'
                  ? 'Generating key pair…'
                  : idState === 'generated' && !keySaved
                    ? 'Save your key first'
                    : resolvedDid
                      ? 'Continue with verified identity →'
                      : 'Continue to task →'}
              </button>
            </div>
            {!resolvedDid && (
              <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                Posting without a DID shows your task as unverified. You can add one at any time.
              </p>
            )}
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
                <h2 id="post-task-title">Describe the task</h2>
                {resolvedDid && (
                  <div className="poster-did-context">
                    <span className="poster-did-badge poster-verified">
                      ✓ Posting as {resolvedDid}
                    </span>
                  </div>
                )}
                {!resolvedDid && (
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
