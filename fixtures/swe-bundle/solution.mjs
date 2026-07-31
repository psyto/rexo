// The delivered code (the maker's diff, applied). Committed and hashed; the
// verifier re-runs tests.mjs against this and recomputes the results.

export function add(a, b) {
  return a + b;
}

export function classify(n) {
  if (n < 0) return "negative";
  if (n === 0) return "zero"; // the fix: the previously-missing zero branch
  return "positive";
}
