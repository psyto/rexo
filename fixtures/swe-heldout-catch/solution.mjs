// Agent deliverable — passes its OWN tests but is subtly wrong.
// `median` returns the upper-middle element for even-length arrays instead of
// the average of the two middle elements. The agent's committed tests only
// cover odd-length inputs, so they pass. An independent held-out test that
// exercises the even-length case catches it — the "tests pass but wrong" case.
export function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
