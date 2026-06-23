// Application submission: captures who is applying, their identity,
// proposal, and contact. Creates a GitHub PR to data/applications/ so
// the poster can review. AT never auto-selects. No escrow, no custody.
import { createSign } from 'node:crypto';

const OWNER = 'observer-protocol';
const REPO = 'at-directory';

const HITS = new Map<string, { n: number; day: string }>();
const MAX_PER_IP_PER_DAY = 10;

interface SubmitBody {
  task_id?: string;
  task_name?: string;
  applicant_name?: string;
  did?: string | null;
  did_verified?: boolean;
  did_tier?: number | null;
  proposal?: string;
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

  if (!body.task_id || !body.applicant_name || !body.proposal || !body.contact) {
    return json({ error: 'task_id, applicant_name, proposal, and contact are required' }, 400);
  }

  const now = new Date().toISOString();
  const slug = slugify(body.applicant_name);
  const ts = Date.now().toString(36);
  const filePath = `data/applications/${body.task_id}/${ts}-${slug}.json`;

  const record = {
    task_id: body.task_id,
    task_name: body.task_name ?? body.task_id,
    applicant_name: body.applicant_name,
    did: body.did ?? null,
    did_verified: body.did_verified ?? false,
    did_tier: body.did_tier ?? null,
    proposal: body.proposal,
    contact: body.contact,
    submitted_at: now,
    ip_hash: await hashIp(ip),
  };

  try {
    const token = await getInstallationToken();
    const prUrl = await openPr(token, filePath, record, body.task_name ?? body.task_id);
    return json({ ok: true, pr_url: prUrl });
  } catch (e) {
    return json({ error: 'github_submission_failed', detail: (e as Error).message }, 502);
  }
}

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + 'at-dir-salt'));
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
    .slice(0, 30);
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

async function openPr(
  token: string,
  filePath: string,
  record: unknown,
  taskName: string,
): Promise<string> {
  const base = 'main';
  const branch = `apply/${filePath.replace(/[^a-z0-9/]/g, '-').replace(/\//g, '--')}`;

  const refRes = await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/${base}`,
    {},
    token,
  );
  const baseSha = ((await refRes.json()) as { object: { sha: string } }).object.sha;

  await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/git/refs`,
    { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }) },
    token,
  );

  const content = b64url(JSON.stringify(record, null, 2) + '\n');
  await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      body: JSON.stringify({ message: `Application: ${taskName}`, content, branch }),
    },
    token,
  );

  const rec = record as {
    applicant_name: string;
    did?: string | null;
    did_verified?: boolean;
    proposal: string;
    contact: string;
  };
  const prRes = await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/pulls`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: `Application: ${taskName} — ${rec.applicant_name}`,
        head: branch,
        base,
        body:
          `Task: **${taskName}**\n\n` +
          `Applicant: **${rec.applicant_name}**\n` +
          (rec.did
            ? `DID: \`${rec.did}\` ${rec.did_verified ? '✓ verified' : '◈ unverified'}\n`
            : '') +
          `\n**Proposal:**\n${rec.proposal}\n\n` +
          `Contact: ${rec.contact}\n\n` +
          `---\n_Review: merge to archive as accepted, close to reject. Do not auto-award. AT does not hold prize funds._`,
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
      'User-Agent': 'at-directory-apply',
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
