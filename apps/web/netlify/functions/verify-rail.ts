// Web-facing mirror of the MCP verify_payment_endpoint tool. Backs the
// "Verify now" buttons on /merchants/[slug]. Reuses the exact same
// rail-by-rail verification as the MCP server (spec §8).
import { loadAllMerchants } from '@at-directory/core';
import { verifyRail } from '@agenticterminal/mcp-server/verify';
import type { RailName } from '@at-directory/core';

const RAILS: RailName[] = ['lightning', 'bolt12', 'l402', 'usdt', 'btc'];

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }
  let body: { merchant_id?: string; rail?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const { merchant_id, rail } = body;
  if (!merchant_id || !rail || !RAILS.includes(rail as RailName)) {
    return json({ error: 'merchant_id and a valid rail are required' }, 400);
  }

  const merchant = loadAllMerchants().find((m) => m.id === merchant_id);
  if (!merchant) return json({ error: 'unknown_merchant' }, 404);
  if (merchant.op_trust_tier > 1) {
    // Web "Verify now" is an anonymous surface; Tier 2+ verification is
    // gated the same way the MCP tool gates it.
    return json({ error: 'credential_required', status: 'unknown' }, 403);
  }
  if (!merchant.rails.some((r) => r.rail === rail)) {
    return json({ error: 'unsupported_rail', status: 'unknown' }, 400);
  }

  try {
    const result = await verifyRail(merchant, rail as RailName);
    return json({
      merchant_id,
      rail,
      status: result.status,
      detail: result.detail,
      checked_at: new Date().toISOString(),
      evidence: result.evidence,
    });
  } catch {
    return json({ status: 'unknown', detail: 'verification_unavailable' }, 200);
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
