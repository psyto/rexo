// Committed remediation suite: one exploit test (the target — passes only when
// the vulnerability is closed) plus invariants that must still hold. The
// verifier re-executes all of these against the committed patched code.

import { createProtocol } from "./vault.mjs";

export const tests = [
  {
    name: "normal borrow within LTV succeeds",
    run: () => {
      const p = createProtocol();
      p.deposit("a", 100);
      p.borrow("a", 40);
      return p.debtOf("a") === 40;
    },
  },
  {
    // TARGET: the exploit. Passes only if borrowing beyond the LTV cap is rejected.
    name: "exploit: borrow beyond LTV is rejected",
    run: () => {
      const p = createProtocol();
      p.deposit("a", 100);
      try {
        p.borrow("a", 80); // > 100 * 0.5 → must be rejected
        return false; // exploit succeeded → vulnerability still open
      } catch {
        return true; // rejected → remediated
      }
    },
  },
  {
    name: "invariant: debt never exceeds collateral * LTV",
    run: () => {
      const p = createProtocol();
      p.deposit("a", 100);
      try { p.borrow("a", 60); } catch { /* rejected is fine */ }
      return p.debtOf("a") <= p.collateralOf("a") * p.LTV;
    },
  },
  {
    name: "invariant: users are isolated",
    run: () => {
      const p = createProtocol();
      p.deposit("a", 100);
      p.deposit("b", 10);
      p.borrow("a", 50);
      try { p.borrow("b", 50); } catch { /* rejected */ }
      return p.debtOf("b") === 0;
    },
  },
];
