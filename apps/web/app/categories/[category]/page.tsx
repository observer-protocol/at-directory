import { notFound } from 'next/navigation';
import { allMerchants, categories, categoryLabel } from '@/lib/data';
import { MerchantCard } from '@/components/MerchantCard';

export function generateStaticParams() {
  return categories().map((c) => ({ category: c.id }));
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const known = categories().some((c) => c.id === category);
  if (!known) notFound();
  const merchants = allMerchants().filter((m) => m.category === category);

  return (
    <div>
      <h1>{categoryLabel(category)}</h1>
      <p className="lede">
        {merchants.length} merchant{merchants.length === 1 ? '' : 's'} in this category.
      </p>
      <div className="grid">
        {merchants.map((m) => (
          <MerchantCard key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
