import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { bootstrap } from './bootstrap.ts';
import { verifyCredential } from './auth.ts';
import { buildServer, resolveSessionAuth } from './server.ts';

export async function main(): Promise<void> {
  const data = await bootstrap();
  const rawCredential = process.env.AT_CREDENTIAL;
  const credential = await verifyCredential(rawCredential, {
    verifierUrl: process.env.AT_VERIFIER_URL,
  });
  const auth = resolveSessionAuth(credential);
  const server = buildServer(data, auth);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP channel.
  process.stderr.write(
    `[at-directory-mcp] ready; ${data.merchants.length} merchants; auth=${auth.identity.tier_cap}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[at-directory-mcp] fatal: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
