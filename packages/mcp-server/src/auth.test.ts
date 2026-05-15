import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _clearCache, toIdentity, verifyCredential } from './auth.ts';

const here = dirname(fileURLToPath(import.meta.url));
const demoCredential = readFileSync(join(here, '..', 'fixtures', 'demo-credential.json'), 'utf8');

let server: Server;
let url: string;

beforeEach(async () => {
  _clearCache();
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const { credential } = JSON.parse(raw) as {
        credential: { credentialSubject?: { id?: string } };
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (credential?.credentialSubject?.id === 'did:key:demo123') {
        res.end(
          JSON.stringify({
            verified: true,
            subject_did: 'did:key:demo123',
            credential: {
              issuer: 'did:web:agenticterminal.io',
              credentialSubject: { directory_access_tier: 'elevated' },
              validUntil: '2026-08-13T18:00:00Z',
            },
          }),
        );
      } else {
        res.end(JSON.stringify({ verified: false }));
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (addr && typeof addr === 'object') url = `http://127.0.0.1:${addr.port}/verify`;
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe('verifyCredential', () => {
  it('returns null when no credential is presented', async () => {
    expect(await verifyCredential(undefined, { verifierUrl: url })).toBeNull();
  });

  it('returns null when verifierUrl is unset (anonymous fallback)', async () => {
    expect(await verifyCredential(demoCredential, {})).toBeNull();
  });

  it('verifies the canned demo credential end to end', async () => {
    const v = await verifyCredential(demoCredential, { verifierUrl: url });
    expect(v).not.toBeNull();
    expect(v!.subjectDid).toBe('did:key:demo123');
    expect(v!.tier).toBe('elevated');
    expect(v!.issuer).toBe('did:web:agenticterminal.io');
    expect(toIdentity(v)).toEqual({ authenticated: true, tier_cap: 'elevated' });
  });

  it('accepts a base64url-encoded credential', async () => {
    const b64 = Buffer.from(demoCredential).toString('base64url');
    const v = await verifyCredential(b64, { verifierUrl: url });
    expect(v?.subjectDid).toBe('did:key:demo123');
  });

  it('rejects a credential the verifier does not recognize', async () => {
    const other = JSON.stringify({
      ...JSON.parse(demoCredential),
      credentialSubject: { id: 'did:key:unknown' },
    });
    expect(await verifyCredential(other, { verifierUrl: url })).toBeNull();
  });

  it('rejects a credential missing required shape before calling verifier', async () => {
    expect(
      await verifyCredential('{"type":["VerifiableCredential"]}', { verifierUrl: url }),
    ).toBeNull();
  });

  it('treats anonymous identity correctly', () => {
    expect(toIdentity(null)).toEqual({ authenticated: false, tier_cap: 'anonymous' });
  });
});
