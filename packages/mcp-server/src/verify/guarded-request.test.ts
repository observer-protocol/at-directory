// Paired tests: every guard assertion has a matching case that must PASS.
// A guard suite that only proves refusal cannot tell "correctly strict" from
// "refuses everything", which is the same defect as a probe that only ever
// returns one verdict.
import { describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import {
  classifyAddress,
  guardedRequest,
  guardedLookup,
  BlockedDestinationError,
} from './guarded-request.ts';

// Permits loopback so the transport behaviour can be exercised against a local
// fixture. Injected per call; there is no env var and no production default.
const allowLoopbackForTest = (ip: string): string | null =>
  /^(127\.|::1$|::ffff:127\.)/.test(ip) ? null : classifyAddress(ip);

describe('classifyAddress — must REFUSE', () => {
  const blocked: Array<[string, RegExp]> = [
    ['127.0.0.1', /loopback/],
    ['127.1.2.3', /loopback/],
    ['::1', /IPv6 loopback/],
    ['10.0.0.1', /RFC1918/],
    ['172.16.0.1', /RFC1918/],
    ['172.31.255.254', /RFC1918/],
    ['192.168.1.1', /RFC1918/],
    ['169.254.169.254', /link-local.*cloud metadata/],
    ['fc00::1', /unique-local/],
    ['fd12:3456::1', /unique-local/],
    ['fe80::1', /IPv6 link-local/],
    ['0.0.0.0', /unspecified/],
    ['::', /unspecified/],
    ['100.64.0.1', /CGNAT/],
    ['224.0.0.1', /multicast|reserved/],
    // IPv4-mapped IPv6 must be unwrapped, not string-matched
    ['::ffff:127.0.0.1', /loopback/],
    ['::ffff:169.254.169.254', /link-local/],
  ];
  for (const [ip, why] of blocked) {
    it(`refuses ${ip}`, () => {
      const reason = classifyAddress(ip);
      expect(reason, `${ip} must be refused`).not.toBeNull();
      expect(reason!).toMatch(why);
    });
  }
});

describe('classifyAddress — must PASS (the guard is strict, not broken)', () => {
  // Public addresses. If these ever start failing the guard has become a
  // denylist of the entire internet, which fails closed but is still wrong.
  for (const ip of [
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34',
    '172.15.0.1', // just below RFC1918 172.16/12
    '172.32.0.1', // just above
    '169.253.0.1', // adjacent to link-local, not in it
    '100.63.255.255', // just below CGNAT 100.64/10
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
  ]) {
    it(`allows ${ip}`, () => {
      expect(classifyAddress(ip), `${ip} must be allowed`).toBeNull();
    });
  }
});

describe('guardedRequest — scheme and literal-IP enforcement', () => {
  it('refuses http:// by default', async () => {
    await expect(guardedRequest('http://example.com/')).rejects.toThrow(/https is required/);
  });

  it('refuses a literal loopback IP in the URL, before any lookup', async () => {
    // A literal IP never reaches the lookup hook, so it must be classified at
    // parse time or the whole guard is bypassed by skipping DNS.
    await expect(guardedRequest('https://127.0.0.1/')).rejects.toThrow(/loopback/);
  });

  it('refuses a literal IPv6 loopback in the URL', async () => {
    await expect(guardedRequest('https://[::1]/')).rejects.toThrow(/IPv6 loopback/);
  });

  it('refuses an unparseable URL', async () => {
    await expect(guardedRequest('not-a-url')).rejects.toBeInstanceOf(BlockedDestinationError);
  });
});

describe('guardedLookup — refuses before connect', () => {
  it('blocks a hostname that resolves to loopback', async () => {
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      guardedLookup('localhost', { family: 0 }, (e) => resolve(e));
    });
    expect(err, 'localhost must be refused').not.toBeNull();
    expect(err!.code).toBe('EBLOCKED');
    // Whichever family localhost resolves to on this host, both are covered.
    expect(err!.message).toMatch(/loopback/);
  });
});

describe('guardedRequest — end to end against a loopback fixture', () => {
  let server: Server;
  let port: number;

  const start = async (handler: Parameters<typeof createServer>[1]): Promise<void> => {
    server = createServer(handler);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as { port: number }).port;
  };

  it('reaches a loopback fixture ONLY with allowInsecure, proving the path works', async () => {
    await start((_q, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    try {
      // Same URL, guard on: refused. This is the paired half — it proves the
      // success below is the guard permitting, not the guard being absent.
      await expect(guardedRequest(`http://127.0.0.1:${port}/`)).rejects.toThrow(
        /https is required/,
      );
      const res = await guardedRequest(`http://127.0.0.1:${port}/`, {
        allowInsecure: true,
        classify: allowLoopbackForTest,
      });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ ok: true });
    } finally {
      server.close();
    }
  });

  it('sends the identifying User-Agent on the wire (not just to a stub)', async () => {
    let seenUa: string | undefined;
    await start((q, res) => {
      seenUa = q.headers['user-agent'];
      res.writeHead(200);
      res.end('ok');
    });
    try {
      await guardedRequest(`http://127.0.0.1:${port}/`, {
        allowInsecure: true,
        classify: allowLoopbackForTest,
      });
      expect(seenUa).toMatch(/AT-Directory-Verifier/);
    } finally {
      server.close();
    }
  });

  it('returns a 3xx rather than following it', async () => {
    await start((q, res) => {
      if (q.url === '/r') {
        res.writeHead(302, { Location: 'https://169.254.169.254/latest/meta-data/' });
        res.end();
      } else {
        res.writeHead(200);
        res.end('final');
      }
    });
    try {
      const res = await guardedRequest(`http://127.0.0.1:${port}/r`, {
        allowInsecure: true,
        classify: allowLoopbackForTest,
      });
      // node:https does not follow redirects. The 3xx comes back intact and the
      // link-local Location is NEVER fetched — following it is what would need
      // per-hop revalidation.
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://169.254.169.254/latest/meta-data/');
      expect(res.body).not.toContain('final');
    } finally {
      server.close();
    }
  });
});
