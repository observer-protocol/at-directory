#!/usr/bin/env node
// Thin launcher. Node >=23.6 strips TypeScript types natively, so the
// package ships source-form for v1. A compiled dist is a v1.x follow-up
// for users on older Node. The hosted endpoint at mcp.agenticterminal.ai
// is the primary path and is unaffected.
import('../src/stdio.ts').catch((err) => {
  process.stderr.write(`[at-directory-mcp] launcher failed: ${err?.stack ?? err}\n`);
  process.stderr.write(
    '[at-directory-mcp] requires Node >= 23.6 (native TS). Check `node --version`.\n',
  );
  process.exit(1);
});
