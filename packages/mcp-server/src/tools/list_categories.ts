import type { Category } from '@at-directory/core';
import type { ToolContext } from '../context.ts';

export interface ListCategoriesResponse {
  categories: Array<{ id: Category; label: string; merchant_count: number }>;
}

export function listCategoriesTool(
  _args: Record<string, never>,
  ctx: ToolContext,
  labels: Record<string, string>,
): ListCategoriesResponse {
  const counts = new Map<string, number>();
  for (const m of ctx.merchants) {
    counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  }
  return {
    categories: Object.entries(labels)
      .map(([id, label]) => ({
        id: id as Category,
        label,
        merchant_count: counts.get(id) ?? 0,
      }))
      .sort((a, b) => b.merchant_count - a.merchant_count || a.id.localeCompare(b.id)),
  };
}
