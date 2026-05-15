import { notFound } from 'next/navigation';
import { allMerchants, rails, railLabel } from '@/lib/data';
import { MerchantCard } from '@/components/MerchantCard';

export function generateStaticParams() {
  return rails().map((r) => ({ rail: r.id }));
}

export default async function RailPage({ params }: { params: Promise<{ rail: string }> }) {
  const { rail } = await params;
  const known = rails().some((r) => r.id === rail);
  if (!known) notFound();
  const merchants = allMerchants().filter((m) => m.rails.some((r) => r.rail === rail));

  return (
    <div>
      <h1>{railLabel(rail)}</h1>
      <p className="lede">
        {merchants.length} merchant{merchants.length === 1 ? '' : 's'} accept this rail.
      </p>
      <div className="grid">
        {merchants.map((m) => (
          <MerchantCard key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
