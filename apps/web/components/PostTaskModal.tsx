'use client';
import { useState } from 'react';

interface Props {
  onClose: () => void;
}

type Status = 'idle' | 'submitting' | 'done' | 'error';

export function PostTaskModal({ onClose }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      budget: fd.get('budget') as string,
      deadline: fd.get('deadline') as string,
      who: fd.get('who') as string,
      contact: fd.get('contact') as string,
      poster_name: fd.get('poster_name') as string,
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
        const data = (await res.json()) as { error?: string };
        setErrorMsg(data.error ?? 'Submission failed. Please try again.');
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

        <h2 id="post-task-title">Post a task</h2>
        <p className="muted modal-subtitle">
          We review and post within a few hours. Payment negotiated directly between parties — AT
          facilitates discovery only.
        </p>

        {status === 'done' ? (
          <div className="modal-success">
            <p>Task submitted. We'll review and post it shortly.</p>
            <p className="muted">Watch @ATDirectory on X for the live listing announcement.</p>
            <button className="task-apply-btn" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="post-task-form">
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
                placeholder="What do you need? What does success look like? Any specific requirements?"
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
                <input name="contact" type="url" required placeholder="https://x.com/yourhandle" />
              </label>
            </div>

            {status === 'error' && <p className="form-error">{errorMsg}</p>}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="task-apply-btn" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Submitting…' : 'Submit task'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
