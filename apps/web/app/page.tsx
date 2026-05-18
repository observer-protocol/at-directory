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
      <h1>OP-verified merchants on the rails Bitcoin and Tether actually use</h1>
      <h2>The Open Agentic Commerce Merchant Directory</h2>
      <p className="lede">
        AT Directory is the open agentic commerce merchant directory for the rails that move real
        commerce — Lightning, BOLT12, L402, and USDT on any chain — with verifiable trust
        attestations issued through Observer Protocol. Tether is bringing USDT onto Lightning via
        Taproot Assets; we index these rails honestly, and agents transact accordingly.
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
