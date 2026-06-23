// DID minting: generates a self-controlled Ed25519 did:key for task posters.
// STAGING ONLY. Gated on ENABLE_DID_MINT=true env flag.
// Key control model: self-controlled (holder holds the key). The server
// generates the key pair, returns BOTH public (DID) and private key to the
// caller in the same response, then discards them. Server never stores keys.
//
// Do NOT publish real DIDs until Leo confirms custodial vs self-controlled
// key custody for did:web issuance. did:key is safe for staging because
// the DID is derived from the public key and carries no persistent state.
import { generateKeyPairSync } from 'node:crypto';

// Multicodec prefix for Ed25519 public key: 0xed 0x01
const ED25519_PREFIX = Buffer.from([0xed, 0x01]);

const HITS = new Map<string, { n: number; day: string }>();
const MAX_PER_IP_PER_DAY = 3;

interface MintBody {
  name?: string;
  email?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  if (!process.env.ENABLE_DID_MINT) {
    return json({
      ok: false,
      staging_only: true,
      message: 'DID minting is in staging only. Request a DID via the form instead.',
    });
  }

  let body: MintBody;
  try {
    body = (await req.json()) as MintBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const ip =
    req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429);

  try {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');

    const pubDer = publicKey.export({ type: 'spki', format: 'der' });
    // SPKI for Ed25519 is 44 bytes: 12 bytes header + 32 bytes raw key
    const rawPub = pubDer.slice(pubDer.length - 32);

    const multicodecKey = Buffer.concat([ED25519_PREFIX, rawPub]);
    const did = `did:key:z${base58btcEncode(multicodecKey)}`;

    const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });
    // PKCS8 for Ed25519: raw private key is last 32 bytes
    const rawPriv = privDer.slice(privDer.length - 32);
    const privateKeyBase58 = base58btcEncode(rawPriv);

    return json({
      ok: true,
      did,
      key_control: 'self-controlled',
      key_type: 'Ed25519',
      private_key_base58: privateKeyBase58,
      warning: 'Save your private key now. It is not stored anywhere. Loss is permanent.',
      staging_note:
        'This is a did:key — portable but not anchored. A did:web will be offered once key custody is finalised.',
      name: body.name ?? null,
    });
  } catch (e) {
    console.error('mint-did error:', (e as Error).message);
    return json({ error: 'keygen_failed' }, 500);
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

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58btcEncode(buf: Buffer | Uint8Array): string {
  let n = BigInt('0x' + Buffer.from(buf).toString('hex'));
  const digits: number[] = [];
  while (n > 0n) {
    digits.unshift(Number(n % 58n));
    n = n / 58n;
  }
  let leadZeros = 0;
  for (const byte of buf) {
    if (byte !== 0) break;
    leadZeros++;
  }
  return '1'.repeat(leadZeros) + digits.map((d) => B58_ALPHABET[d]).join('');
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
