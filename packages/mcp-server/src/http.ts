import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { bootstrap, type DirectoryData } from './bootstrap.ts';
import { verifyCredential } from './auth.ts';
import { buildServer, resolveSessionAuth } from './server.ts';

const PORT = Number(process.env.PORT ?? 8099);
const MCP_PATH = '/mcp';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function handleMcp(
  req: IncomingMessage,
  res: ServerResponse,
  data: DirectoryData,
): Promise<void> {
  const rawCredential = req.headers['x-at-credential'];
  const credentialStr = Array.isArray(rawCredential) ? rawCredential[0] : rawCredential;
  const credential = await verifyCredential(credentialStr, {
    verifierUrl: process.env.AT_VERIFIER_URL,
  });
  const auth = resolveSessionAuth(credential);
  const server = buildServer(data, auth);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);

  const body = await readBody(req);
  let parsed: unknown;
  try {
    parsed = body ? JSON.parse(body) : undefined;
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid JSON body' }));
    return;
  }
  await transport.handleRequest(req, res, parsed);
}

export async function main(): Promise<void> {
  const data = await bootstrap();
  const httpServer = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, merchants: data.merchants.length }));
      return;
    }
    if (req.url?.startsWith(MCP_PATH) && req.method === 'POST') {
      handleMcp(req, res, data).catch((err) => {
        process.stderr.write(`[at-directory-mcp http] ${(err as Error).stack ?? err}\n`);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'internal error' }));
        }
      });
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  httpServer.listen(PORT, () => {
    process.stderr.write(
      `[at-directory-mcp http] listening on :${PORT}${MCP_PATH}; ${data.merchants.length} merchants\n`,
    );
  });
}

main().catch((err) => {
  process.stderr.write(`[at-directory-mcp http] fatal: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
