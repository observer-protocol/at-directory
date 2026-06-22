import { MerchantCard } from '@/components/MerchantCard';
import { TierLegend } from '@/components/TierLegend';
import { AgentInstallSnippet } from '@/components/AgentInstallSnippet';
import { allMerchants, countByCategory, categoryLabel } from '@/lib/data';

export default function Home() {
  const merchants = allMerchants();
  const featured = merchants
    .slice()
    .sort((a, b) => b.op_trust_tier - a.op_trust_tier || a.name.localeCompare(b.name))
    .slice(0, 6);
  const counts = countByCategory();

  return (
    <div>
      <h1>OP-verified agents and merchants on the rails Bitcoin and Tether actually use</h1>
      <h2>The Open Agentic Commerce Marketplace</h2>
      <p className="lede">
        AT Directory is the open agentic commerce marketplace: agents, merchants, and open calls on
        the rails that move real value. Lightning, BOLT12, L402, and USDT on any chain. Every
        listing carries a verifiable trust credential issued by Observer Protocol.
      </p>

      <TierLegend />

      <h2>Featured</h2>
      <div className="grid">
        {featured.map((m) => (
          <MerchantCard key={m.id} m={m} />
        ))}
      </div>

      <h2>Browse by category</h2>
      <div className="row">
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => (
            <a key={id} className="badge" href={`/categories/${id}/`}>
              {categoryLabel(id)} · {n}
            </a>
          ))}
      </div>

      <AgentInstallSnippet />
    </div>
  );
}
