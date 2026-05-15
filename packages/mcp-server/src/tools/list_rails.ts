import type { RailName, UsdtChain } from '@at-directory/core';
import type { ToolContext } from '../context.ts';

export interface RailsManifest {
  rails: Array<{
    id: RailName;
    label: string;
    chains?: Array<{ id: UsdtChain; label: string }>;
  }>;
}

export interface ListRailsResponse {
  rails: Array<{
    rail: RailName;
    label: string;
    merchant_count: number;
    chains?: Array<{ chain: UsdtChain; label: string; merchant_count: number }>;
  }>;
}

export function listRailsTool(
  _args: Record<string, never>,
  ctx: ToolContext,
  manifest: RailsManifest,
): ListRailsResponse {
  const railCounts = new Map<RailName, number>();
  const chainCounts = new Map<UsdtChain, number>();
  for (const m of ctx.merchants) {
    for (const r of m.rails) {
      railCounts.set(r.rail, (railCounts.get(r.rail) ?? 0) + 1);
      if (r.chain) chainCounts.set(r.chain, (chainCounts.get(r.chain) ?? 0) + 1);
    }
  }

  return {
    rails: manifest.rails.map((entry) => {
      const out: ListRailsResponse['rails'][number] = {
        rail: entry.id,
        label: entry.label,
        merchant_count: railCounts.get(entry.id) ?? 0,
      };
      if (entry.chains) {
        out.chains = entry.chains.map((c) => ({
          chain: c.id,
          label: c.label,
          merchant_count: chainCounts.get(c.id) ?? 0,
        }));
      }
      return out;
    }),
  };
}
