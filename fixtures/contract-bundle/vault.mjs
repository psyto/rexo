// The delivered (patched) protocol logic. Committed and hashed; the verifier
// re-runs tests.mjs against this. A runnable stand-in for a Solidity remediation
// — the same adapter would drive a Foundry/forge or invariant-fuzz run.
//
// Bug being remediated: borrow() did not enforce the collateral/LTV cap, so an
// attacker could borrow beyond their collateral (under-collateralized debt).

export function createProtocol() {
  const collateral = new Map();
  const debt = new Map();
  const LTV = 0.5;
  return {
    LTV,
    deposit(u, amt) {
      collateral.set(u, (collateral.get(u) ?? 0) + amt);
    },
    borrow(u, amt) {
      const cap = (collateral.get(u) ?? 0) * LTV;
      const cur = debt.get(u) ?? 0;
      if (cur + amt > cap) throw new Error("exceeds LTV cap"); // the fix
      debt.set(u, cur + amt);
    },
    debtOf(u) {
      return debt.get(u) ?? 0;
    },
    collateralOf(u) {
      return collateral.get(u) ?? 0;
    },
  };
}
