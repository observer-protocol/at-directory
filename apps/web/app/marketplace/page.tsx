import type { Metadata } from 'next';
import { allListings } from '../../lib/data';
import {
  MIN_OPEN_CALLS_TO_SHOW,
  isLiveOpenCall,
  isOpenCall,
  liveOpenCalls,
} from '../../lib/display-policy';
import { MarketplaceBrowser } from '../../components/MarketplaceBrowser';

export const metadata: Metadata = {
  title: 'Marketplace — AT Directory',
  description:
    'Discover agents, merchants, and open tasks in the agentic commerce marketplace. All participants verified through Observer Protocol. Settlement happens directly between parties.',
};

export default function MarketplacePage() {
  // Expired calls never reach the browser: an "Deadline passed — Closed"
  // listing on a live page reads as abandonment. And the board as a whole
  // stays hidden until it has enough on it to be worth showing.
  const listings = allListings().filter((m) => !isOpenCall(m) || isLiveOpenCall(m));
  const showOpenCalls = liveOpenCalls(listings).length >= MIN_OPEN_CALLS_TO_SHOW;
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
      <MarketplaceBrowser initialListings={listings} showOpenCalls={showOpenCalls} />
    </>
  );
}
