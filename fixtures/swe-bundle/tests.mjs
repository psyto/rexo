// The committed test suite. Imports the committed solution and exercises it.
// `run` returns true on pass. The verifier re-executes all of these.

import { add, classify } from "./solution.mjs";

export const tests = [
  { name: "adds two numbers", run: () => add(2, 3) === 5 },
  { name: "adds negatives", run: () => add(-2, -3) === -5 },
  { name: "classifies positive", run: () => classify(4) === "positive" },
  { name: "classifies zero", run: () => classify(0) === "zero" },
  { name: "classifies negative", run: () => classify(-1) === "negative" },
];
