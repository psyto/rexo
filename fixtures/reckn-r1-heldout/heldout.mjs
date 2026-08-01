// INDEPENDENT held-out suite for the reckn R1 fix.
//
// Authored from the SPEC of the remediation — "a replay must ignore tx-validity
// gating (base-fee / nonce) while still enforcing balance" — NOT copied from the
// agent's committed tests. It uses different base-fee/nonce/balance values and
// boundary cases the committed suite never exercises, so it is a genuine
// held-out correctness signal, not the agent grading its own homework.
import { replay, reproduced, expectResult } from "./solution.mjs";

const GWEI = 1_000_000_000;
const E18 = 10n ** 18n;
const GOOD = "swap-out>=1000USDC-good-output";
const predGood = { kind: "ResultEquals", expectedHash: expectResult(GOOD) };

export const tests = [
  {
    // gating must be ignored at values unlike the committed 1 gwei / nonce 7
    name: "held-out: honest reproduces at 5 gwei base_fee, caller nonce 11",
    run: () => reproduced(replay({ baseFee: 5 * GWEI }, { nonce: 11, balance: E18 }, { gasPrice: 0, nonce: 0, value: 0n, calldata: GOOD }, predGood)),
  },
  {
    name: "held-out: honest reproduces under extreme 100 gwei / nonce 999",
    run: () => reproduced(replay({ baseFee: 100 * GWEI }, { nonce: 999, balance: E18 }, { gasPrice: 0, nonce: 0, value: 0n, calldata: GOOD }, predGood)),
  },
  {
    // balance must STILL be enforced — a boundary overspend (balance+1) fails
    name: "held-out: overspend by exactly balance+1 is rejected",
    run: () => {
      const out = replay({ baseFee: 3 * GWEI }, { nonce: 4, balance: 1000n }, { gasPrice: 0, nonce: 0, value: 1001n, calldata: GOOD }, predGood);
      return out.verdict === "Failed" && out.reason === "OutOfFunds";
    },
  },
  {
    // a different wrong output than the committed suite's must still be rejected
    name: "held-out: a distinct false claim is rejected",
    run: () => {
      const out = replay({ baseFee: 2 * GWEI }, { nonce: 8, balance: E18 }, { gasPrice: 0, nonce: 0, value: 0n, calldata: "swap-out>=999USDC-off-by-one" }, predGood);
      return out.verdict === "Failed" && out.reason === "PredicateMismatch";
    },
  },
];
