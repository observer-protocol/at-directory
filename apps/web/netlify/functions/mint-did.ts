// DID minting: holder generates their Ed25519 key pair client-side.
// Server receives only the public key (publicKeyMultibase) and publishes
// the did:web DID document. Private key is generated and stays in the
// holder's browser — it is never transmitted to this server.
//
// Key custody: self-controlled (holder controls the key).
// DID hosting: AT serves the did.json at did:web:agenticterminal.ai:posters:{slug}.
// Gated on ENABLE_DID_MINT=true.
import { createHash, createSign } from 'node:crypto';

const OWNER = 'observer-protocol';
const REPO = 'at-directory';

// base58btc alphabet
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58Decode(s: string): Buffer {
  let n = BigInt(0);
  for (const c of s) {
    const idx = B58.indexOf(c);
    if (idx < 0) throw new Error(`bad base58 char: ${c}`);
    n = n * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  let leadZeros = 0;
  for (const c of s) {
    if (c !== '1') break;
    leadZeros++;
  }
  return Buffer.from([...Array(leadZeros).fill(0), ...bytes]);
}

// Validate incoming multibase and extract the raw 32-byte Ed25519 public key.
function extractPubKey(publicKeyMultibase: string): Buffer {
  if (!publicKeyMultibase.startsWith('z'))
    throw new Error('publicKeyMultibase must use base58btc (z prefix)');
  const raw = b58Decode(publicKeyMultibase.slice(1));
  if (raw.length !== 34)
    throw new Error(`expected 34 bytes (2 multicodec + 32 key), got ${raw.length}`);
  if (raw[0] !== 0xed || raw[1] !== 0x01)
    throw new Error('expected Ed25519 multicodec prefix 0xed 0x01');
  return raw.slice(2);
}

// Slug is the first 20 hex chars of SHA-256(raw public key).
// Deterministic: same public key always produces the same slug.
// The server recomputes this rather than trusting a client-supplied slug.
function slugFromPubKey(rawPubKey: Buffer): string {
  return createHash('sha256').update(rawPubKey).digest('hex').slice(0, 20);
}

const HITS = new Map<string, { n: number; day: string }>();
const MAX_PER_IP_PER_DAY = 3;

interface MintBody {
  publicKeyMultibase?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  if (!process.env.ENABLE_DID_MINT) {
    return json({
      ok: false,
      staging_only: true,
      message: 'DID minting is not yet enabled on this deployment.',
    });
  }

  let body: MintBody;
  try {
    body = (await req.json()) as MintBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!body.publicKeyMultibase) {
    return json({ error: 'publicKeyMultibase is required' }, 400);
  }

  const ip =
    req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429);

  let rawPubKey: Buffer;
  try {
    rawPubKey = extractPubKey(body.publicKeyMultibase);
  } catch (e) {
    return json({ error: `invalid_public_key: ${(e as Error).message}` }, 400);
  }

  const slug = slugFromPubKey(rawPubKey);
  const did = `did:web:agenticterminal.ai:posters:${slug}`;
  const keyId = `${did}#key-1`;

  const didDocument = {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: 'Multikey',
        controller: did,
        publicKeyMultibase: body.publicKeyMultibase,
      },
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
  };

  // DID resolves to: https://agenticterminal.ai/posters/{slug}/did.json
  const filePath = `apps/web/public/posters/${slug}/did.json`;

  try {
    const token = await getInstallationToken();

    // Idempotent: if this key already has a DID document, return the existing DID
    if (await fileExists(token, filePath)) {
      return json({ ok: true, did, existing: true });
    }

    await commitToMain(token, filePath, didDocument, slug);
    return json({ ok: true, did });
  } catch (e) {
    console.error('mint-did error:', (e as Error).message);
    return json({ error: 'github_commit_failed', detail: (e as Error).message }, 502);
  }
}

function rateLimited(ip: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const cur = HITS.get(ip);
  if (!cur || cur.day !== day) {
    HITS.set(ip, { n: 1, day });
    return false;
  }
  cur.n += 1;
  return cur.n > MAX_PER_IP_PER_DAY;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function appJwt(): string {
  const appId = required('GITHUB_APP_ID');
  const pem = required('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${b64url(signer.sign(pem))}`;
}

async function getInstallationToken(): Promise<string> {
  const installationId = required('GITHUB_INSTALLATION_ID');
  const res = await gh(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    { method: 'POST' },
    appJwt(),
  );
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error('no installation token');
  return data.token;
}

async function fileExists(token: string, path: string): Promise<boolean> {
  const res = await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    {},
    token,
    true,
  );
  return res.status === 200;
}

async function commitToMain(
  token: string,
  filePath: string,
  doc: unknown,
  slug: string,
): Promise<void> {
  await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: `Publish DID document: posters/${slug}`,
        content: b64url(JSON.stringify(doc, null, 2) + '\n'),
        branch: 'main',
      }),
    },
    token,
  );
}

async function gh(
  url: string,
  init: RequestInit,
  token: string,
  allowNotFound = false,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'at-directory-mint-did',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok && !(allowNotFound && res.status === 404)) {
    throw new Error(`GitHub ${init.method ?? 'GET'} ${url} → ${res.status}`);
  }
  return res;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
