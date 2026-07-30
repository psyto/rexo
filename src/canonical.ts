// Deterministic JSON serialization: object keys sorted recursively, arrays kept
// in order. Two structurally-equal values always produce the same string, so a
// third party can recompute commitments and verify signatures reproducibly.
//
// Security note: the accumulator is a NULL-prototype object. With a plain `{}`,
// assigning `out["__proto__"] = v` hits the prototype setter and the key
// silently vanishes from the output — letting an attacker append a `__proto__`
// field to a signed receipt that survives signature + privacy checks (which run
// on the canonical form) yet ships a secret in the raw JSON bytes. With a
// null-prototype object, `__proto__` becomes an ordinary own property that is
// sorted, serialized, signed over, and scanned like any other key.

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(obj).sort()) {
      const v = obj[key];
      if (v === undefined) continue; // omit undefined so JSON is stable
      out[key] = sortValue(v);
    }
    return out;
  }
  return value;
}
