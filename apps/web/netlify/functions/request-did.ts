// DID issuance request: stub until Leo signs off on namespace + key control.
// Creates a PR to data/did-requests/ so Boyd can manually issue the DID
// and reply to the requester. Namespace: TBD pending Leo gate 1.
import { createSign } from 'node:crypto';

const OWNER = 'observer-protocol';
const REPO = 'at-directory';

interface RequestBody {
  name?: string;
  email?: string;
  handle?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!body.name || !body.email) {
    return json({ error: 'name and email are required' }, 400);
  }

  const ts = Date.now().toString(36);
  const slug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  const filePath = `data/did-requests/${ts}-${slug}.json`;

  const record = {
    name: body.name,
    email: body.email,
    handle: body.handle ?? null,
    requested_at: new Date().toISOString(),
    status: 'pending',
    note: 'DID namespace pending Leo gate-1 sign-off. Issue manually once namespace confirmed.',
  };

  try {
    const token = await getInstallationToken();
    await openPr(token, filePath, record, body.name);
    return json({ ok: true });
  } catch (e) {
    // Fail silently to the user — Boyd gets the request via other means
    console.error('DID request PR failed:', (e as Error).message);
    return json({ ok: true });
  }
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
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${appJwt()}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'at-directory-did-request',
      },
    },
  );
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error('no installation token');
  return data.token;
}

async function openPr(
  token: string,
  filePath: string,
  record: unknown,
  name: string,
): Promise<void> {
  const base = 'main';
  const branch = `did-request/${filePath
    .split('/')
    .pop()!
    .replace(/\.json$/, '')}`;

  const refRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/${base}`,
    { headers: ghHeaders(token) },
  );
  const baseSha = ((await refRes.json()) as { object: { sha: string } }).object.sha;

  await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs`, {
    method: 'POST',
    headers: ghHeaders(token),
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  });

  await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify({
      message: `DID request: ${name}`,
      content: b64url(JSON.stringify(record, null, 2) + '\n'),
      branch,
    }),
  });

  const rec = record as { name: string; email: string; handle?: string | null };
  await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/pulls`, {
    method: 'POST',
    headers: ghHeaders(token),
    body: JSON.stringify({
      title: `DID request: ${rec.name}`,
      head: branch,
      base,
      body:
        `Name: **${rec.name}**\nEmail: ${rec.email}\n` +
        (rec.handle ? `Handle/URL: ${rec.handle}\n` : '') +
        `\n---\n_Issue DID manually once Leo namespace gate-1 is cleared. Reply to requester with their \`did:web\`._`,
    }),
  });
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'at-directory-did-request',
    'Content-Type': 'application/json',
  };
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
