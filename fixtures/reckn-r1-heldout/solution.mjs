// Faithful minimal reproduction of reckn's reexec-evm replay after fix R1
// (psyto/reckn commit c189f83, reexec-evm/src/lib.rs).
//
// A replay adjudicates whether the seller's CALL satisfies the funded predicate
// against the committed prestate — NOT whether it is a valid fee-paying,
// correctly-nonced transaction. The fix disables base-fee and nonce gating in
// the replay cfg, while KEEPING balance enforced (that is prestate truth, not
// tx-validity ceremony). Replays always run with gas_price = 0.

// The fix, applied: both tx-validity gates disabled in the replay cfg.
const REPLAY_CFG = { disableBaseFee: true, disableNonceCheck: true };

// tiny deterministic digest, stands in for keccak256 in the predicate compare
function digest(s) {
  let h = 1469598103934665603n;
  for (const ch of String(s)) h = ((h ^ BigInt(ch.charCodeAt(0))) * 1099511628211n) & ((1n << 64n) - 1n);
  return h.toString(16);
}

export function expectResult(s) {
  return digest(s);
}
export function reproduced(out) {
  return out.verdict === "Reproduced";
}

export function replay(anchor, caller, plan, predicate, cfg = REPLAY_CFG) {
  // --- revm pre-execution tx-validity gating ---
  // Before R1 these ran with gas_price=0 against real base_fee/nonce and
  // wrongly rejected honest deliveries. The fix disables them here.
  if (!cfg.disableBaseFee && plan.gasPrice < anchor.baseFee)
    return { verdict: "Failed", reason: "GasPriceLessThanBasefee" };
  if (!cfg.disableNonceCheck && plan.nonce !== caller.nonce)
    return { verdict: "Failed", reason: "NonceMismatch" };

  // --- balance is prestate truth — never disabled ---
  if (plan.value > caller.balance) return { verdict: "Failed", reason: "OutOfFunds" };

  // --- execute the CALL (identity target returns its calldata) & adjudicate ---
  const result = plan.calldata;
  if (predicate.kind === "ResultEquals" && digest(result) === predicate.expectedHash)
    return { verdict: "Reproduced" };
  return { verdict: "Failed", reason: "PredicateMismatch" };
}
