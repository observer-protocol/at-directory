import { MerchantCard } from '@/components/MerchantCard';
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
      <h1>Where agents discover OP-verified merchants</h1>
      <p className="lede">
        AT Directory indexes merchants accepting Lightning, BOLT12, L402, or USDT (any chain), with
        verifiable trust attestations issued through Observer Protocol. It is the agent-callable
        layer on the rails Bitcoin and Tether actually use.
      </p>

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
