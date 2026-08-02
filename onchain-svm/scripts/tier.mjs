// Held-out correctness tier → on-chain ERC-8004 validationResponse fields.
//
// The tier is the durability signal (see docs/07 §2): re-running an agent's OWN
// committed tests is self-graded and weak — SWE-Bench's own tests are often too
// weak to tell: a 2025 study found 345 patches that passed but did not resolve the
// issue (UTBoost, arXiv:2506.09289). An INDEPENDENT
// held-out suite (authored by the task issuer, unseen by the agent) is what
// separates "passed its own tests" from "actually correct".
//
// We encode that tier honestly into the standard ERC-8004 fields so the assurance
// level is legible on-chain, not hidden in an off-chain receipt:
//   - response (0..100): the assurance the score deserves, not a cosmetic 100.
//   - tag (bytes32):     the human-legible tier label.
//   - responseHash:      a reproducible commitment to the re-execution FACTS
//                        (below), so anyone can re-run and check the on-chain hash.
import { createHash } from "node:crypto";

export const TIERS = {
  "held-out-verified": { response: 100, tag: "held-out-verified" }, // passed committed + independent held-out
  "committed-only":    { response: 70,  tag: "committed-only" },    // passed its own tests only (self-graded, weak)
  "held-out-FAILED":   { response: 0,   tag: "held-out-FAILED" },   // passed its own tests but held-out caught it (pass-but-wrong)
};

// Deterministic tier from the two suites' results.
export function tierOf({ committedPassed, committedTotal, heldoutPresent, heldoutPassed, heldoutTotal }) {
  const committedAll = committedTotal > 0 && committedPassed === committedTotal;
  if (!heldoutPresent) return "committed-only";
  const heldoutAll = heldoutTotal > 0 && heldoutPassed === heldoutTotal;
  if (committedAll && heldoutAll) return "held-out-verified";
  return "held-out-FAILED";
}

// Canonical (sorted-key) JSON over primitive facts — stable across machines.
function canonical(obj) {
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + JSON.stringify(obj[k])).join(",") + "}";
}

// The reproducible on-chain responseHash: sha256 over the re-execution facts.
// Binds the exact result (both suites) + the tier — re-run to reproduce it.
export function tierCommitment(facts) {
  const wire = canonical({
    v: 1,
    bundle: facts.bundle,
    committedPassed: facts.committedPassed,
    committedTotal: facts.committedTotal,
    heldoutPresent: facts.heldoutPresent,
    heldoutPassed: facts.heldoutPassed,
    heldoutTotal: facts.heldoutTotal,
    tier: facts.tier,
  });
  return createHash("sha256").update(wire).digest("hex");
}

// tag string → 32-byte buffer (right-padded with 0x00), for the SVM record.
export function tagBytes32(tag) {
  const b = Buffer.alloc(32);
  Buffer.from(tag, "utf8").copy(b, 0, 0, Math.min(32, Buffer.byteLength(tag)));
  return b;
}

// tag string → bytes32 hex literal (for the EVM `bytes32("...")` equivalent).
export function tagHex(tag) {
  return "0x" + tagBytes32(tag).toString("hex");
}

// Re-run a bundle's committed (tests.mjs) + independent held-out (heldout.mjs)
// suites and return the exact on-chain validationResponse fields for its tier.
// Reproducible: same bundle → same responseHash the chain records.
export async function deriveTier(dir) {
  const { pathToFileURL } = await import("node:url");
  const { resolve, basename } = await import("node:path");
  const { existsSync } = await import("node:fs");
  const bundle = basename(dir);
  const run = async (file) => {
    if (!existsSync(file)) return null;
    const mod = await import(pathToFileURL(file).href);
    const tests = mod.tests || [];
    let passed = 0;
    for (const t of tests) { let ok = false; try { ok = t.run() === true; } catch { ok = false; } if (ok) passed++; }
    return { passed, total: tests.length };
  };
  const committed = await run(resolve(dir, "tests.mjs"));
  if (!committed) throw new Error(`no tests.mjs in ${dir}`);
  const heldout = await run(resolve(dir, "heldout.mjs"));
  const facts = {
    bundle,
    committedPassed: committed.passed, committedTotal: committed.total,
    heldoutPresent: heldout !== null,
    heldoutPassed: heldout ? heldout.passed : 0,
    heldoutTotal: heldout ? heldout.total : 0,
  };
  const tier = tierOf(facts);
  const responseHash = tierCommitment({ ...facts, tier });
  const { response, tag } = TIERS[tier];
  return {
    bundle, committed: `${committed.passed}/${committed.total}`,
    heldout: heldout ? `${heldout.passed}/${heldout.total}` : "absent",
    tier, response, tag, tagHex: tagHex(tag), responseHash,
  };
}
