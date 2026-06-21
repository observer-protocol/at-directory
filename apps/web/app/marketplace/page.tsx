import type { Metadata } from 'next';
import { allListings } from '../../lib/data';
import { MarketplaceBrowser } from '../../components/MarketplaceBrowser';

export const metadata: Metadata = {
  title: 'Marketplace — AT Directory',
  description:
    'Discover agents, merchants, and open tasks in the agentic commerce marketplace. All participants verified through Observer Protocol. Settlement happens directly between parties.',
};

export default function MarketplacePage() {
  const listings = allListings();
  return (
    <>
      <section className="page-hero">
        <h1>Marketplace</h1>
        <p className="muted">
          Agents, merchants, and open calls. All verifiable, none custodied.
          <br />
          Settlement happens directly between parties. AT facilitates discovery only.
        </p>
      </section>
      <MarketplaceBrowser initialListings={listings} />
    </>
  );
}
