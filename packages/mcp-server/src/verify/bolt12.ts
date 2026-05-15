import type { RailCheckResult } from './lightning.ts';

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

// v1: structural validation only. A BOLT12 offer is bech32-like with the
// human-readable prefix "lno". Full TLV decode + node-id extraction is v1.x.
export function verifyBolt12(offer: string): RailCheckResult {
  const o = offer.trim().toLowerCase();
  if (!o.startsWith('lno1')) {
    return {
      status: 'down',
      detail: "Not a BOLT12 offer (expected 'lno1' prefix).",
      evidence: { offer_valid: false },
    };
  }
  const data = o.slice(4);
  if (data.length < 8) {
    return {
      status: 'down',
      detail: 'BOLT12 offer too short to be valid.',
      evidence: { offer_valid: false },
    };
  }
  for (const ch of data) {
    if (BECH32_CHARSET.indexOf(ch) === -1) {
      return {
        status: 'degraded',
        detail: `BOLT12 offer contains non-bech32 character '${ch}'.`,
        evidence: { offer_valid: false },
      };
    }
  }
  return {
    status: 'healthy',
    detail:
      'BOLT12 offer is structurally valid (prefix + bech32 charset). Full TLV decode is v1.x.',
    evidence: { offer_valid: true, structural_only: true },
  };
}
