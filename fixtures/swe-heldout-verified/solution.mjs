// Agent deliverable — correct: averages the two middle elements for even-length
// arrays. Passes both the agent's own committed suite and the independent
// held-out suite → the strong "held-out-verified" tier.
export function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length, m = Math.floor(n / 2);
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
