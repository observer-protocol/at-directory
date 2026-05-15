import type { AgentIdentity, AgentIdentityTier } from '@at-directory/core';

export interface AuthConfig {
  verifierUrl?: string;
}

export interface VerifiedCredential {
  subjectDid: string;
  tier: AgentIdentityTier;
  issuer: string;
  validUntil?: string;
  raw: unknown;
}

interface RevocationCacheEntry {
  result: VerifiedCredential | null;
  expiresAt: number;
}

const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 300_000;
const revocationCache = new Map<string, RevocationCacheEntry>();

export const ANONYMOUS_IDENTITY: AgentIdentity = {
  authenticated: false,
  tier_cap: 'anonymous',
};

export function toIdentity(verified: VerifiedCredential | null): AgentIdentity {
  if (!verified) return ANONYMOUS_IDENTITY;
  return { authenticated: true, tier_cap: verified.tier };
}

export async function verifyCredential(
  rawCredential: string | undefined,
  config: AuthConfig,
): Promise<VerifiedCredential | null> {
  if (!rawCredential) return null;
  const credential = decodeCredential(rawCredential);
  if (!credential) return null;

  if (!hasRequiredShape(credential)) return null;

  const cacheKey = await hashCredential(rawCredential);
  const cached = revocationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const verifier = config.verifierUrl;
  if (!verifier) {
    return cacheAndReturn(cacheKey, null, NEGATIVE_TTL_MS);
  }

  let response: Response;
  try {
    response = await fetch(verifier, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
  } catch {
    return cacheAndReturn(cacheKey, null, NEGATIVE_TTL_MS);
  }

  if (!response.ok) {
    return cacheAndReturn(cacheKey, null, NEGATIVE_TTL_MS);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return cacheAndReturn(cacheKey, null, NEGATIVE_TTL_MS);
  }

  if (!isVerifierSuccess(body)) {
    return cacheAndReturn(cacheKey, null, NEGATIVE_TTL_MS);
  }

  const subject = (body.credential.credentialSubject ?? {}) as Record<string, unknown>;
  const verified: VerifiedCredential = {
    subjectDid: body.subject_did,
    tier: normalizeTier(subject.directory_access_tier as string | undefined),
    issuer: body.credential.issuer,
    validUntil: body.credential.validUntil,
    raw: credential,
  };
  return cacheAndReturn(cacheKey, verified, POSITIVE_TTL_MS);
}

function decodeCredential(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed) as Record<string, unknown>;
    }
    const decoded = Buffer.from(trimmed, 'base64url').toString('utf8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasRequiredShape(c: Record<string, unknown>): boolean {
  return (
    Array.isArray(c.type) &&
    c.type.includes('VerifiableCredential') &&
    c.type.includes('DirectoryAccessCredential') &&
    typeof c.issuer === 'string' &&
    typeof c.credentialSubject === 'object' &&
    c.credentialSubject !== null &&
    typeof (c.credentialSubject as Record<string, unknown>).id === 'string' &&
    typeof c.proof === 'object' &&
    c.proof !== null
  );
}

async function hashCredential(raw: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(raw).digest('hex');
}

function cacheAndReturn(
  key: string,
  result: VerifiedCredential | null,
  ttlMs: number,
): VerifiedCredential | null {
  revocationCache.set(key, { result, expiresAt: Date.now() + ttlMs });
  return result;
}

// AT verifier contract (shared with the AT issuer route built in the other
// CC session — see spec §5.2). Request: POST { credential: <VC JSON> }.
// Success: { verified: true, subject_did, credential: { issuer,
// credentialSubject: { directory_access_tier }, validUntil? } }.
// Failure: { verified: false } (any HTTP status).
interface VerifierSuccessBody {
  verified: true;
  subject_did: string;
  credential: {
    issuer: string;
    credentialSubject?: Record<string, unknown>;
    validUntil?: string;
  };
}

function isVerifierSuccess(body: unknown): body is VerifierSuccessBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (b.verified !== true) return false;
  if (typeof b.subject_did !== 'string') return false;
  const cred = b.credential as Record<string, unknown> | undefined;
  return typeof cred === 'object' && cred !== null && typeof cred.issuer === 'string';
}

function normalizeTier(tier: string | undefined): AgentIdentityTier {
  switch (tier) {
    case 'basic':
    case 'elevated':
    case 'premium':
      return tier;
    default:
      return 'basic';
  }
}

export function _clearCache(): void {
  revocationCache.clear();
}
