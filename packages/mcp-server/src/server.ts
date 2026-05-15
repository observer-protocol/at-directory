import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AgentIdentity } from '@at-directory/core';
import type { DirectoryData } from './bootstrap.ts';
import { toIdentity, type VerifiedCredential } from './auth.ts';
import type { ToolContext } from './context.ts';
import { SearchMerchantsArgs, searchMerchantsTool } from './tools/search_merchants.ts';
import { GetMerchantArgs, getMerchantTool } from './tools/get_merchant.ts';
import {
  VerifyPaymentEndpointArgs,
  verifyPaymentEndpointTool,
} from './tools/verify_payment_endpoint.ts';
import { listCategoriesTool } from './tools/list_categories.ts';
import { listRailsTool } from './tools/list_rails.ts';
import { whoamiTool, type WhoamiContext } from './tools/whoami.ts';

export interface SessionAuth {
  identity: AgentIdentity;
  credential: VerifiedCredential | null;
}

function asJson(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

export function buildServer(data: DirectoryData, auth: SessionAuth): McpServer {
  const server = new McpServer({ name: 'at-directory', version: '0.0.1' });

  const ctx: ToolContext = {
    merchants: data.merchants,
    identity: auth.identity,
  };

  server.tool(
    'search_merchants',
    'Search OP-verified merchants by rail, chain, category, agent-callable tier, trust tier, and free text. Ranked by trust tier then verification recency.',
    SearchMerchantsArgs.shape,
    async (args) => asJson(searchMerchantsTool(SearchMerchantsArgs.parse(args), ctx)),
  );

  server.tool(
    'get_merchant',
    'Get the full record for one merchant including all rails, payment endpoints, and OP attestation. Tier 2+ requires an AT credential.',
    GetMerchantArgs.shape,
    async (args) => asJson(getMerchantTool(GetMerchantArgs.parse(args), ctx)),
  );

  server.tool(
    'verify_payment_endpoint',
    "Run a live check against a merchant's declared payment endpoint for a rail. Returns health, detail, and rail-specific evidence.",
    VerifyPaymentEndpointArgs.shape,
    async (args) =>
      asJson(await verifyPaymentEndpointTool(VerifyPaymentEndpointArgs.parse(args), ctx)),
  );

  server.tool('list_categories', 'List the category taxonomy with merchant counts.', {}, async () =>
    asJson(listCategoriesTool({}, ctx, data.categoryLabels)),
  );

  server.tool(
    'list_rails',
    'List supported payment rails and their current merchant counts.',
    {},
    async () => asJson(listRailsTool({}, ctx, data.railsManifest)),
  );

  server.tool(
    'whoami',
    'Report the resolved credential state and rate limits for the calling agent.',
    {},
    async () => {
      const wctx: WhoamiContext = { ...ctx };
      if (auth.credential) {
        wctx.credentialDetails = {
          subject_did: auth.credential.subjectDid,
          issuer: auth.credential.issuer,
          ...(auth.credential.validUntil ? { valid_until: auth.credential.validUntil } : {}),
        };
      }
      return asJson(whoamiTool({}, wctx));
    },
  );

  return server;
}

export function resolveSessionAuth(credential: VerifiedCredential | null): SessionAuth {
  return { identity: toIdentity(credential), credential };
}
