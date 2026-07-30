// Deterministic JSON serialization: object keys sorted recursively, arrays kept
// in order. Two structurally-equal values always produce the same string, so a
// third party can recompute commitments and verify signatures reproducibly.

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const v = obj[key];
      if (v === undefined) continue; // omit undefined so JSON is stable
      out[key] = sortValue(v);
    }
    return out;
  }
  return value;
}
