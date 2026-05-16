// Plain HTTP/REST read surface, same data layer and process as the MCP
// server. For agent runtimes that don't speak MCP (OpenClaw, custom
// Lightning-native agents). Reads only, anonymous, ungated — matches the
// directory's read posture (spec §4.3). Credentialed writes are not in
// the REST scope. Mounted under /v1 on the hosted server.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DirectoryData } from './bootstrap.ts';
import { ANONYMOUS_IDENTITY } from './auth.ts';
import type { ToolContext } from './context.ts';
import { SearchMerchantsArgs, searchMerchantsTool } from './tools/search_merchants.ts';
import { getMerchantTool } from './tools/get_merchant.ts';
import { listCategoriesTool } from './tools/list_categories.ts';
import { listRailsTool } from './tools/list_rails.ts';
import {
  VerifyPaymentEndpointArgs,
  verifyPaymentEndpointTool,
} from './tools/verify_payment_endpoint.ts';

const REST_PREFIX = '/v1';

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    // Public read API for arbitrary agent clients.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(json);
}

function coerceSearch(qs: URLSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const str = (k: string) => {
    const v = qs.get(k);
    if (v !== null && v !== '') out[k] = v;
  };
  str('query');
  str('rail');
  str('chain');
  str('category');
  str('agent_callable_tier');
  const tier = qs.get('trust_tier_min');
  if (tier !== null && tier !== '') out.trust_tier_min = Number(tier);
  const usdc = qs.get('accepts_usdc');
  if (usdc !== null && usdc !== '') out.accepts_usdc = usdc === 'true' || usdc === '1';
  const limit = qs.get('limit');
  if (limit !== null && limit !== '') out.limit = Number(limit);
  return out;
}

// Returns true if the request was a /v1 path (handled or errored here),
// false if the caller should keep routing (e.g. /mcp, /healthz, 404).
export async function tryHandleRest(
  req: IncomingMessage,
  res: ServerResponse,
  data: DirectoryData,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== REST_PREFIX && !path.startsWith(`${REST_PREFIX}/`)) return false;

  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return true;
  }

  const ctx: ToolContext = { merchants: data.merchants, identity: ANONYMOUS_IDENTITY };
  const method = req.method ?? 'GET';

  try {
    // GET /v1/merchants
    if (path === `${REST_PREFIX}/merchants` && method === 'GET') {
      const parsed = SearchMerchantsArgs.safeParse(coerceSearch(url.searchParams));
      if (!parsed.success) {
        send(res, 400, { error: 'invalid_query', detail: parsed.error.flatten() });
        return true;
      }
      send(res, 200, searchMerchantsTool(parsed.data, ctx));
      return true;
    }

    // GET /v1/categories
    if (path === `${REST_PREFIX}/categories` && method === 'GET') {
      send(res, 200, listCategoriesTool({}, ctx, data.categoryLabels));
      return true;
    }

    // GET /v1/rails
    if (path === `${REST_PREFIX}/rails` && method === 'GET') {
      send(res, 200, listRailsTool({}, ctx, data.railsManifest));
      return true;
    }

    // POST /v1/merchants/{id}/verify?rail=lightning
    const verifyMatch = path.match(/^\/v1\/merchants\/([^/]+)\/verify$/);
    if (verifyMatch) {
      if (method !== 'POST') {
        send(res, 405, { error: 'method_not_allowed', detail: 'use POST' });
        return true;
      }
      const args = VerifyPaymentEndpointArgs.safeParse({
        merchant_id: decodeURIComponent(verifyMatch[1]!),
        rail: url.searchParams.get('rail') ?? undefined,
      });
      if (!args.success) {
        send(res, 400, { error: 'invalid_request', detail: args.error.flatten() });
        return true;
      }
      const result = await verifyPaymentEndpointTool(args.data, ctx);
      send(res, 'error' in result ? 400 : 200, result);
      return true;
    }

    // GET /v1/merchants/{id}
    const getMatch = path.match(/^\/v1\/merchants\/([^/]+)$/);
    if (getMatch && method === 'GET') {
      const result = getMerchantTool({ id: decodeURIComponent(getMatch[1]!) }, ctx);
      send(res, 'error' in result ? 404 : 200, result);
      return true;
    }

    send(res, 404, { error: 'not_found', detail: `no REST route for ${method} ${path}` });
    return true;
  } catch (e) {
    send(res, 500, { error: 'internal_error', detail: (e as Error).message });
    return true;
  }
}
