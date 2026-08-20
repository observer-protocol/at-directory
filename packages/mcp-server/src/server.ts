import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
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

function asJson(value: unknown, structured = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    ...(structured && typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { structuredContent: value as Record<string, unknown> }
      : {}),
  };
}

const AgentIdentityOutput = z
  .object({
    authenticated: z.boolean(),
    tier_cap: z.enum(['anonymous', 'basic', 'elevated', 'premium']),
  })
  .strict();

const ListCategoriesOutput = z
  .object({
    categories: z.array(
      z
        .object({
          id: z.string(),
          label: z.string(),
          merchant_count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict();

const ListRailsOutput = z
  .object({
    rails: z.array(
      z
        .object({
          rail: z.enum(['lightning', 'bolt12', 'l402', 'usdt', 'usdc', 'btc', 'fiat']),
          label: z.string(),
          merchant_count: z.number().int().nonnegative(),
          chains: z
            .array(
              z
                .object({
                  chain: z.enum([
                    'tron',
                    'ethereum',
                    'solana',
                    'bsc',
                    'polygon',
                    'arbitrum',
                    'base',
                  ]),
                  label: z.string(),
                  merchant_count: z.number().int().nonnegative(),
                })
                .strict(),
            )
            .optional(),
        })
        .strict(),
    ),
  })
  .strict();

const WhoamiOutput = z
  .object({
    authenticated: z.boolean(),
    tier_cap: AgentIdentityOutput.shape.tier_cap,
    limits: z
      .object({
        result_cap: z.number().int().nonnegative(),
        requests_per_minute: z.number().int().positive(),
      })
      .strict(),
    credential: z
      .object({
        subject_did: z.string(),
        issuer: z.string(),
        valid_until: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function buildServer(data: DirectoryData, auth: SessionAuth): McpServer {
  const server = new McpServer({ name: 'at-directory', version: '0.0.1' });

  const ctx: ToolContext = {
    merchants: data.merchants,
    identity: auth.identity,
  };

  server.registerTool(
    'search_merchants',
    {
      title: 'Search Agent Commerce Merchants',
      description:
        'Search OP-verified merchants by rail, chain, category, agent-callable tier, trust tier, and free text. Ranked by trust tier then verification recency.',
      inputSchema: SearchMerchantsArgs,
    },
    async (args) => asJson(searchMerchantsTool(SearchMerchantsArgs.parse(args), ctx)),
  );

  server.registerTool(
    'get_merchant',
    {
      title: 'Get Agent Commerce Merchant',
      description:
        'Get the full record for one merchant including all rails, payment endpoints, and OP attestation. Anonymous and credentialed callers receive the same read result; credentials affect rate limits, not merchant visibility.',
      inputSchema: GetMerchantArgs,
    },
    async (args) => asJson(getMerchantTool(GetMerchantArgs.parse(args), ctx)),
  );

  server.registerTool(
    'verify_payment_endpoint',
    {
      title: 'Verify Merchant Payment Endpoint',
      description:
        "Run a live check against a merchant's declared payment endpoint for a rail. Returns health, detail, and rail-specific evidence.",
      inputSchema: VerifyPaymentEndpointArgs,
    },
    async (args) =>
      asJson(await verifyPaymentEndpointTool(VerifyPaymentEndpointArgs.parse(args), ctx)),
  );

  server.registerTool(
    'list_categories',
    {
      title: 'List Merchant Categories',
      description: 'List the category taxonomy with merchant counts.',
      inputSchema: z.object({}).strict(),
      outputSchema: ListCategoriesOutput,
    },
    async () => asJson(listCategoriesTool({}, ctx, data.categoryLabels), true),
  );

  server.registerTool(
    'list_rails',
    {
      title: 'List Supported Payment Rails',
      description: 'List supported payment rails and their current merchant counts.',
      inputSchema: z.object({}).strict(),
      outputSchema: ListRailsOutput,
    },
    async () => asJson(listRailsTool({}, ctx, data.railsManifest), true),
  );

  server.registerTool(
    'whoami',
    {
      title: 'Inspect Agent Directory Session',
      description: 'Report the resolved credential state and rate limits for the calling agent.',
      inputSchema: z.object({}).strict(),
      outputSchema: WhoamiOutput,
    },
    async () => {
      const wctx: WhoamiContext = { ...ctx };
      if (auth.credential) {
        wctx.credentialDetails = {
          subject_did: auth.credential.subjectDid,
          issuer: auth.credential.issuer,
          ...(auth.credential.validUntil ? { valid_until: auth.credential.validUntil } : {}),
        };
      }
      return asJson(whoamiTool({}, wctx), true);
    },
  );

  return server;
}

export function resolveSessionAuth(credential: VerifiedCredential | null): SessionAuth {
  return { identity: toIdentity(credential), credential };
}
