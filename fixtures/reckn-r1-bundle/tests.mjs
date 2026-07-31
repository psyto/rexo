// Committed suite for the R1 remediation. The TARGET is the regression test that
// only passes once base-fee/nonce gating is disabled; the rest are invariants
// that must still hold (balance enforced, honest zero-fee case, false claims fail).

import { replay, reproduced, expectResult } from "./solution.mjs";

const ONE_GWEI = 1_000_000_000;
const E18 = 10n ** 18n;
const GOOD = "swap-out>=1000USDC-good-output";
const predGood = { kind: "ResultEquals", expectedHash: expectResult(GOOD) };

export const tests = [
  {
    // TARGET (review R1): honest delivery must reproduce against a realistic
    // anchor (base_fee > 0) and caller (nonce > 0). Pre-fix this was Failed.
    name: "honest delivery reproduces under real base_fee/nonce",
    run: () => {
      const anchor = { baseFee: ONE_GWEI };
      const caller = { nonce: 7, balance: E18 };
      const plan = { gasPrice: 0, nonce: 0, value: 0n, calldata: GOOD };
      return reproduced(replay(anchor, caller, plan, predGood));
    },
  },
  {
    name: "honest delivery reproduces under zero base_fee/nonce",
    run: () => {
      const anchor = { baseFee: 0 };
      const caller = { nonce: 0, balance: E18 };
      const plan = { gasPrice: 0, nonce: 0, value: 0n, calldata: GOOD };
      return reproduced(replay(anchor, caller, plan, predGood));
    },
  },
  {
    name: "invariant: balance still enforced (overspend fails)",
    run: () => {
      const anchor = { baseFee: ONE_GWEI };
      const caller = { nonce: 7, balance: 5n };
      const plan = { gasPrice: 0, nonce: 0, value: 1000n, calldata: GOOD };
      const out = replay(anchor, caller, plan, predGood);
      return out.verdict === "Failed" && out.reason === "OutOfFunds";
    },
  },
  {
    name: "invariant: false claim fails (predicate mismatch)",
    run: () => {
      const anchor = { baseFee: ONE_GWEI };
      const caller = { nonce: 7, balance: E18 };
      const plan = { gasPrice: 0, nonce: 0, value: 0n, calldata: "swap-out<1000USDC-bad" };
      const out = replay(anchor, caller, plan, predGood);
      return out.verdict === "Failed" && out.reason === "PredicateMismatch";
    },
  },
];
