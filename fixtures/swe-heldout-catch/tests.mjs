// The agent's OWN committed suite — only exercises odd-length inputs, so a
// wrong even-length implementation still passes here (self-graded, weak).
import { median } from "./solution.mjs";

export const tests = [
  { name: "median of odd-length array", run: () => median([3, 1, 2]) === 2 },
  { name: "median of single element", run: () => median([7]) === 7 },
  { name: "median unaffected by input order", run: () => median([9, 1, 5]) === 5 },
];
