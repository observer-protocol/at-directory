// Local stand-in for AT's POST /api/v1/credentials/verify route while the
// real one is built in the other CC session. Implements the contract in
// spec §5.2. Swap via AT_VERIFIER_URL when the real route lands.
//
//   tsx packages/mcp-server/src/dev/mock-verifier.ts
//   AT_VERIFIER_URL=http://127.0.0.1:8787/verify <run the MCP server>
//
// Accepts exactly the canned demo credential (credentialSubject.id ===
// "did:key:demo123"); everything else gets { verified: false }.
import { createServer, type IncomingMessage } from 'node:http';

const PORT = Number(process.env.MOCK_VERIFIER_PORT ?? 8787);
const DEMO_SUBJECT = 'did:key:demo123';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }
  readBody(req)
    .then((raw) => {
      let credential: Record<string, unknown> | undefined;
      try {
        const parsed = JSON.parse(raw) as { credential?: Record<string, unknown> };
        credential = parsed.credential;
      } catch {
        credential = undefined;
      }
      const subject = (credential?.credentialSubject ?? {}) as Record<string, unknown>;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (credential && subject.id === DEMO_SUBJECT) {
        res.end(
          JSON.stringify({
            verified: true,
            subject_did: DEMO_SUBJECT,
            credential: {
              issuer: credential.issuer,
              credentialSubject: subject,
              validUntil: credential.validUntil,
            },
          }),
        );
      } else {
        res.end(JSON.stringify({ verified: false }));
      }
    })
    .catch(() => {
      res.writeHead(500).end();
    });
}).listen(PORT, () => {
  process.stderr.write(`[mock-verifier] listening on http://127.0.0.1:${PORT}\n`);
});
