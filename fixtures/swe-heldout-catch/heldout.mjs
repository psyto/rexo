// INDEPENDENT held-out suite — authored by the task issuer, withheld from the
// agent. It exercises the even-length case the agent's own tests never touch,
// so it fails a deliverable that only "passes its own tests."
import { median } from "./solution.mjs";

export const tests = [
  { name: "median of even-length array averages the two middle", run: () => median([1, 2, 3, 4]) === 2.5 },
  { name: "median of two elements", run: () => median([10, 20]) === 15 },
];
