// Self-registration: form → schema validation → Turnstile → rate limit
// → GitHub PR via a fine-scoped GitHub App. No live datastore (spec §6.5).
// The App can open PRs but branch protection prevents it merging; Boyd
// and Maxi merge. New entries land at Tier 1, source self-registered.
import { createSign } from 'node:crypto';
import { validateMerchantRecord } from '@at-directory/core';

const OWNER = 'observer-protocol';
const REPO = 'at-directory';

// Best-effort per-cold-start rate limit. Durable cross-instance limiting
// is a v1.x concern (needs a store); Turnstile is the real spam gate.
const HITS = new Map<string, { n: number; day: string }>();
const MAX_PER_IP_PER_DAY = 10;

interface SubmitBody {
  name?: string;
  url?: string;
  description?: string;
  category?: string;
  rail?: string;
  pricing_model?: string;
  contact?: string;
  turnstileToken?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const ip =
    req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429);

  const turnstileOk = await verifyTurnstile(body.turnstileToken, ip);
  if (!turnstileOk) return json({ error: 'turnstile_failed' }, 403);

  if (!body.name || !body.url || !body.description || !body.category || !body.rail) {
    return json({ error: 'name, url, description, category, rail are required' }, 400);
  }

  const slug = slugify(body.name);
  if (!slug) return json({ error: 'could not derive a slug from name' }, 400);

  const record = {
    id: slug,
    name: body.name,
    url: body.url,
    description: body.description,
    category: body.category,
    rails: [
      {
        rail: body.rail,
        ...(body.rail === 'usdt' ? { chain: 'tron' } : {}),
        payment_endpoint: null,
        health: 'unknown',
        last_health_check: null,
      },
    ],
    op_trust_tier: 1,
    agent_callable_tier: 'human-checkout',
    accepts_usdc: false,
    accepts_x402: false,
    pricing_model: body.pricing_model ?? 'variable',
    last_verified_at: null,
    source: 'self-registered',
    op_attestation_url: null,
    tags: [body.category],
  };

  const check = validateMerchantRecord(record);
  if (!check.valid) {
    return json({ error: 'schema_validation_failed', details: check.errors }, 422);
  }

  try {
    const token = await getInstallationToken();
    const collision = await fileExists(token, `data/merchants/${slug}.json`);
    if (collision) return json({ error: `merchant '${slug}' already exists` }, 409);
    const prUrl = await openPr(token, slug, record, body.contact);
    return json({ ok: true, pr_url: prUrl });
  } catch (e) {
    return json({ error: 'github_submission_failed', detail: (e as Error).message }, 502);
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

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // No secret configured (local/dev): accept the sentinel, reject blanks.
  if (!secret) return token === 'dev' || (!!token && token.length > 0);
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
  });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

// --- GitHub App auth (RS256 JWT → installation token), fetch-only ---

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
  const sig = b64url(signer.sign(pem));
  return `${header}.${payload}.${sig}`;
}

async function getInstallationToken(): Promise<string> {
  const installationId = required('GITHUB_INSTALLATION_ID');
  const res = await gh(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    { method: 'POST' },
    appJwt(),
  );
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error('no installation token returned');
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

async function openPr(
  token: string,
  slug: string,
  record: unknown,
  contact: string | undefined,
): Promise<string> {
  const base = 'main';
  const branch = `submit/${slug}-${Date.now()}`;

  const refRes = await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/${base}`,
    {},
    token,
  );
  const baseSha = ((await refRes.json()) as { object: { sha: string } }).object.sha;

  await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/git/refs`,
    {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    },
    token,
  );

  await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/data/merchants/${slug}.json`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: `Add merchant: ${slug} (self-registered)`,
        content: b64url(JSON.stringify(record, null, 2) + '\n'),
        branch,
      }),
    },
    token,
  );

  const prRes = await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/pulls`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: `Add merchant: ${slug}`,
        head: branch,
        base,
        body:
          `Self-registered via the submission form. Lands at Tier 1 until verified.\n\n` +
          `Contact: ${contact ?? '(none provided)'}\n\n` +
          `Review checklist: confirm rails at the real checkout, set category, ` +
          `add logo, verify endpoints.`,
      }),
    },
    token,
  );
  const pr = (await prRes.json()) as { html_url?: string };
  if (!pr.html_url) throw new Error('PR creation returned no URL');
  return pr.html_url;
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
      'User-Agent': 'at-directory-submit',
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
