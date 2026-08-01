// Re-run a bundle's committed + independent held-out suites and print the exact
// on-chain validationResponse fields (response, tag, responseHash) for its tier.
//
//   node scripts/compute-tier.mjs ../fixtures/reckn-r1-heldout
//
// The responseHash it prints is what the SVM post script and the EVM PoC anchor —
// reproducible: re-run this and you get the same hash the chain records.
import { resolve } from "node:path";
import { deriveTier } from "./tier.mjs";

const dir = resolve(process.argv[2] || "../fixtures/reckn-r1-heldout");
console.log(JSON.stringify(await deriveTier(dir), null, 2));
