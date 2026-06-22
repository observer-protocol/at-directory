'use client';

import { useState } from 'react';

// eddsa-jcs-2022 in-browser verification.
// Fetches the VC from its static URL, resolves the issuer DID from
// observerprotocol.org (no AT server call), and verifies the Ed25519 signature.

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58Decode(s: string): Uint8Array<ArrayBuffer> {
  let n = BigInt(0);
  for (const c of s) {
    const idx = B58_ALPHABET.indexOf(c);
    if (idx < 0) throw new Error(`Bad base58 char: ${c}`);
    n = n * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  let leading = 0;
  for (const c of s) { if (c !== '1') break; leading++; }
  const out = new Uint8Array(leading + bytes.length);
  bytes.forEach((b, i) => { out[leading + i] = b; });
  return out;
}

function multibaseDecodeEd25519(multibase: string): Uint8Array<ArrayBuffer> {
  if (!multibase.startsWith('z')) throw new Error('Expected base58btc multibase (z prefix)');
  const raw = b58Decode(multibase.slice(1));
  if (raw[0] !== 0xed || raw[1] !== 0x01) throw new Error('Not an Ed25519 multicodec key');
  return new Uint8Array(raw.buffer.slice(2));
}

function jcs(val: unknown): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + (val as unknown[]).map(jcs).join(',') + ']';
  const obj = val as Record<string, unknown>;
  return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + jcs(obj[k])).join(',') + '}';
}

async function sha256(data: string): Promise<Uint8Array<ArrayBuffer>> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return new Uint8Array(buf);
}

interface VcProof {
  type: string;
  cryptosuite: string;
  verificationMethod: string;
  proofValue: string;
  [k: string]: unknown;
}

interface Vc {
  issuer: string;
  validFrom?: string;
  validUntil?: string;
  credentialSubject?: { trustTier?: number; [k: string]: unknown };
  proof: VcProof;
  [k: string]: unknown;
}

interface VerifyResult {
  ok: boolean;
  tier?: number;
  issuerDid: string;
  vm: string;
  validUntil?: string;
  error?: string;
}

async function verifyVc(vcUrl: string): Promise<VerifyResult> {
  const vcRes = await fetch(vcUrl);
  if (!vcRes.ok) throw new Error(`VC fetch failed: ${vcRes.status}`);
  const vc: Vc = await vcRes.json();

  const { proof, ...document } = vc;
  if (!proof?.proofValue) throw new Error('No proofValue in proof');
  if (proof.cryptosuite !== 'eddsa-jcs-2022') throw new Error(`Unsupported suite: ${proof.cryptosuite}`);

  const { proofValue, ...proofConfig } = proof;

  const [hashProofConfig, hashDocument] = await Promise.all([
    sha256(jcs(proofConfig)),
    sha256(jcs(document)),
  ]);
  const message = new Uint8Array(64);
  message.set(hashProofConfig, 0);
  message.set(hashDocument, 32);

  const vmId: string = proof.verificationMethod;
  const didStr = vmId.includes('#') ? vmId.split('#')[0] : vmId;
  const didDocUrl = didStr.replace('did:web:', 'https://').replace(/:/g, '/') + '/.well-known/did.json';
  // did:web resolves: did:web:example.com → https://example.com/.well-known/did.json
  // did:web:example.com:path → https://example.com/path/did.json
  // For did:web:observerprotocol.org the simple replacement holds.
  const didRes = await fetch(didDocUrl);
  if (!didRes.ok) throw new Error(`DID doc fetch failed: ${didRes.status}`);
  const didDoc = await didRes.json();

  const vm = (didDoc.verificationMethod as Array<{ id: string; publicKeyMultibase?: string }>)
    ?.find(v => v.id === vmId || v.id === '#' + vmId.split('#')[1]);
  if (!vm?.publicKeyMultibase) throw new Error(`Key not found in DID doc: ${vmId}`);

  const rawPubKey = multibaseDecodeEd25519(vm.publicKeyMultibase);
  const sigBytes = b58Decode(proofValue.slice(1));

  const cryptoKey = await crypto.subtle.importKey('raw', rawPubKey, { name: 'Ed25519' }, false, ['verify']);
  const valid = await crypto.subtle.verify({ name: 'Ed25519' }, cryptoKey, sigBytes, message);

  return {
    ok: valid,
    tier: vc.credentialSubject?.trustTier,
    issuerDid: vc.issuer as string,
    vm: vmId,
    validUntil: vc.validUntil,
    error: valid ? undefined : 'Signature invalid',
  };
}

export function MerchantTrustPanel({ vcUrl }: { vcUrl: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function run() {
    setState('loading');
    setResult(null);
    setErrorMsg('');
    try {
      const r = await verifyVc(vcUrl);
      setResult(r);
      setState('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }

  const validDate = result?.validUntil ? new Date(result.validUntil).toLocaleDateString() : null;

  return (
    <div className="trust-panel">
      {state === 'idle' && (
        <button className="verify-btn" onClick={run}>
          ◈ Verify credential
        </button>
      )}
      {state === 'loading' && (
        <span className="trust-panel-loading">Verifying…</span>
      )}
      {state === 'done' && result && (
        <div className={`trust-panel-result ${result.ok ? 'vp-valid' : 'vp-invalid'}`}>
          <div className="vp-status">
            {result.ok ? '✓ Valid — Ed25519 signature confirmed' : '✗ Invalid signature'}
          </div>
          {result.tier !== undefined && (
            <div className="vp-row">
              <span className="vp-label">Trust tier</span>
              <span className="vp-value">Tier {result.tier}</span>
            </div>
          )}
          <div className="vp-row">
            <span className="vp-label">Issuer</span>
            <span className="vp-value vp-mono">{result.issuerDid}</span>
          </div>
          <div className="vp-row">
            <span className="vp-label">Key</span>
            <span className="vp-value vp-mono">{result.vm.split('#')[1]}</span>
          </div>
          {validDate && (
            <div className="vp-row">
              <span className="vp-label">Valid until</span>
              <span className="vp-value">{validDate}</span>
            </div>
          )}
          <div className="vp-note">No AT server call — resolved issuer DID directly</div>
          <button className="vp-retry" onClick={() => setState('idle')}>↺</button>
        </div>
      )}
      {state === 'error' && (
        <div className="trust-panel-result vp-invalid">
          <div className="vp-status">Could not verify</div>
          <div className="vp-note">{errorMsg}</div>
          <button className="vp-retry" onClick={() => setState('idle')}>↺ Retry</button>
        </div>
      )}
    </div>
  );
}
