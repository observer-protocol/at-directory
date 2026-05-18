import { MerchantBrowser } from '@/components/MerchantBrowser';
import { allMerchants, categories, rails, countByCategory, categoryLabel } from '@/lib/data';

export default function MerchantsPage() {
  return (
    <div>
      <h1>Merchants</h1>
      <p className="lede">
        Every indexed merchant. Filter by rail, category, agent-callable tier, OP trust tier, and
        USDC. The same data the MCP server returns, rendered for humans.
      </p>
      <div className="row">
        {Object.entries(countByCategory())
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => (
            <a key={id} className="badge" href={`/categories/${id}/`}>
              {categoryLabel(id)} · {n}
            </a>
          ))}
      </div>
      <MerchantBrowser
        merchants={allMerchants()}
        categories={categories()}
        rails={rails().map((r) => ({ id: r.id, label: r.label }))}
      />
    </div>
  );
}
