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
