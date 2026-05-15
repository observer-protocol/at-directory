#!/usr/bin/env tsx
import { loadAllMerchants, MerchantLoadError } from '../packages/core/src/load.ts';

try {
  const merchants = loadAllMerchants();
  console.log(`OK: loaded ${merchants.length} merchant record(s).`);
  process.exit(0);
} catch (e) {
  if (e instanceof MerchantLoadError) {
    console.error(`FAIL: ${e.message}`);
    if (e.details) console.error(JSON.stringify(e.details, null, 2));
  } else {
    console.error(e);
  }
  process.exit(1);
}
