import type { Merchant, RailName } from '@at-directory/core';
import { verifyLightning, type RailCheckResult } from './lightning.ts';
import { verifyL402 } from './l402.ts';
import { verifyBolt12 } from './bolt12.ts';
import { verifyUsdtAddress } from './usdt.ts';

export type { RailCheckResult } from './lightning.ts';

export async function verifyRail(merchant: Merchant, rail: RailName): Promise<RailCheckResult> {
  const railObj = merchant.rails.find((r) => r.rail === rail);
  if (!railObj) {
    return {
      status: 'unknown',
      detail: `Merchant '${merchant.id}' does not declare the '${rail}' rail.`,
      evidence: {},
    };
  }
  const endpoint = railObj.payment_endpoint ?? null;

  // Per-invoice / attestation-only rail: no static endpoint exists to
  // live-probe (payment instructions are generated per-purchase), but the
  // rail's recorded health is canonical and attested (set by an
  // enterprise attestation or the review pass). Reporting a generic
  // "no endpoint declared / unknown" here would mislead any agent into
  // thinking this is a data gap. Surface the attested state honestly and
  // make clear the probe is not applicable. Generalizes to every
  // per-invoice merchant, not just the headline one.
  if (!endpoint && railObj.health !== 'unknown') {
    const tier = merchant.op_trust_tier;
    const lastVerified = merchant.last_verified_at ?? railObj.last_health_check ?? null;
    return {
      status: railObj.health,
      detail:
        `Per-invoice merchant: no static ${rail} endpoint to live-probe ` +
        `(payment instructions are generated per-purchase). Health is ` +
        `${tier >= 2 ? 'enterprise-attested' : 'self-attested'} (Tier ${tier})` +
        `${lastVerified ? `, last verified ${lastVerified}` : ''}.`,
      evidence: {
        probe: 'not-applicable',
        attested: true,
        attested_health: railObj.health,
        op_trust_tier: tier,
        last_verified_at: lastVerified,
      },
    };
  }

  switch (rail) {
    case 'lightning':
      return verifyLightning(merchant.url, endpoint);
    case 'l402':
      if (!endpoint) {
        return {
          status: 'unknown',
          detail: 'No L402 endpoint declared on this rail.',
          evidence: {},
        };
      }
      return verifyL402(endpoint);
    case 'bolt12':
      if (!endpoint) {
        return {
          status: 'unknown',
          detail: 'No BOLT12 offer declared on this rail.',
          evidence: {},
        };
      }
      return verifyBolt12(endpoint);
    case 'usdt': {
      if (!endpoint) {
        return {
          status: 'unknown',
          detail: 'No USDT deposit address declared on this rail.',
          evidence: {},
        };
      }
      const chain = railObj.chain;
      if (!chain) {
        return {
          status: 'unknown',
          detail: 'USDT rail missing chain discriminator.',
          evidence: {},
        };
      }
      const ev = verifyUsdtAddress(endpoint, chain);
      return {
        status: ev.address_valid ? 'healthy' : 'down',
        detail: ev.detail,
        evidence: { ...ev },
      };
    }
  }
}
