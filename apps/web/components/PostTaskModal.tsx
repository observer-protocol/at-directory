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
  | 'requested';

// Minimal DID resolve: just checks that did:web resolves to a valid DID doc
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

  // DID request / mint state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [mintedDid, setMintedDid] = useState<string | null>(null);
  const [mintedKey, setMintedKey] = useState<string | null>(null);

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

  async function handleRequestDid(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('req_name') as string;
    const email = fd.get('req_email') as string;
    const handle = fd.get('req_handle') as string;

    // Try mint-did first (staging only when ENABLE_DID_MINT=true server-side)
    try {
      const mintRes = await fetch('/.netlify/functions/mint-did', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const mintData = (await mintRes.json()) as {
        ok?: boolean;
        staging_only?: boolean;
        did?: string;
        private_key_base58?: string;
        warning?: string;
      };
      if (mintData.ok && mintData.did) {
        setMintedDid(mintData.did);
        setMintedKey(mintData.private_key_base58 ?? null);
        setRequestSubmitted(true);
        setIdState('requested');
        setResolvedDid(mintData.did);
        setDidVerified(true);
        return;
      }
    } catch {
      /* mint unavailable, fall through to request form */
    }

    // Fallback: file a DID request PR for manual issuance
    try {
      await fetch('/.netlify/functions/request-did', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, handle }),
      });
    } catch {
      /* best-effort */
    }
    setRequestSubmitted(true);
    setIdState('requested');
    setDidVerified(false);
    setResolvedDid(null);
  }

  function proceedToTask() {
    if (idState === 'idle' && !showRequestForm) return;
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

  const canProceed = idState === 'did-only' || idState === 'verified' || idState === 'requested';

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
                {idState === 'error' && <span className="id-badge id-badge-err">✗ {idNote}</span>}
                {idState === 'requested' && (
                  <span className="id-badge id-badge-did">
                    ◈ DID requested — task posts as unverified
                  </span>
                )}
              </label>

              {!showRequestForm && !requestSubmitted && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => setShowRequestForm(true)}
                >
                  I don't have a DID yet →
                </button>
              )}

              {requestSubmitted && mintedDid && (
                <div className="did-request-box">
                  <p
                    style={{
                      marginBottom: '0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#3fb950',
                    }}
                  >
                    ✓ DID minted
                  </p>
                  <code
                    style={{
                      fontSize: '0.78rem',
                      wordBreak: 'break-all',
                      display: 'block',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {mintedDid}
                  </code>
                  {mintedKey && (
                    <>
                      <p
                        style={{
                          fontSize: '0.78rem',
                          color: '#fbbf24',
                          marginBottom: '0.35rem',
                          fontWeight: 600,
                        }}
                      >
                        Save your private key now. It is not stored anywhere. Loss is permanent.
                      </p>
                      <code
                        style={{ fontSize: '0.74rem', wordBreak: 'break-all', display: 'block' }}
                      >
                        {mintedKey}
                      </code>
                    </>
                  )}
                </div>
              )}

              {showRequestForm && !requestSubmitted && (
                <div className="did-request-box">
                  <p className="muted" style={{ fontSize: '0.83rem', marginBottom: '0.75rem' }}>
                    Request a free OP DID. You'll receive it within 24 hours and can update your
                    task post once it's issued.
                  </p>
                  <form onSubmit={handleRequestDid} className="post-task-form">
                    <div className="form-row-2">
                      <label>
                        Name or handle <span className="required">*</span>
                        <input
                          name="req_name"
                          type="text"
                          required
                          placeholder="Your name or @handle"
                        />
                      </label>
                      <label>
                        Email <span className="required">*</span>
                        <input
                          name="req_email"
                          type="email"
                          required
                          placeholder="you@example.com"
                        />
                      </label>
                    </div>
                    <label>
                      Website or social URL
                      <input name="req_handle" type="url" placeholder="https://yoursite.com" />
                    </label>
                    <div className="form-actions" style={{ marginTop: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setShowRequestForm(false)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="task-apply-btn">
                        Request DID
                      </button>
                    </div>
                  </form>
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
                <p>Task submitted for review.</p>
                <p className="muted">
                  We review and post within a few hours. Your identity
                  {didVerified ? ' (OP verified)' : ' (unverified)'} will appear on the listing.
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
                {idState === 'requested' && (
                  <div className="poster-did-context">
                    <span className="poster-did-badge poster-unverified">
                      ◈ Posting as unverified (DID pending)
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
