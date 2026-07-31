// Guards for every value that crosses into a published receipt.
//
// Lesson from review round 2: the scanner is not a sufficient gate for public
// strings — it cannot see Base64/high-entropy secrets, names, or addresses. So
// structural fields are *validated to a shape* (reject on violation) rather than
// merely scanned, and free-text labels are redacted AND bounded (length +
// control chars). Arbitrary free text never reaches a published field.

import { redactString } from "./redact/scanner.js";

export const EVENT_KINDS = new Set(["llm_call", "tool_call", "edit", "eval"]);

const SLUG = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/; // lowercase slug — rejects mixed-case Base64
const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const CONTROL = /[\u0000-\u001F\u007F]/;
const MAX_LABEL = 48;

// SCOPE NOTE (review round 3, #1):
// Shape validation CANNOT prove an open-vocabulary label is secret-free — a
// short Base64 secret is indistinguishable from a legitimate slug (both are
// alphanumeric). So the secret-free GUARANTEE is scoped to customer/execution-
// derived data (rawText, inputs, keys), which is dropped/redacted/scanned.
// Maker-authored public LABELS (category, tool, metric names, attestation refs,
// summary) are redacted + bounded + control-stripped and treated like the free
// fields of a résumé: the maker's own public statements, shown in the approval
// step before publish (NFR-04). For a closed-vocabulary deployment, pass an
// `allow` set to `label()` to enforce an enum instead.

/** Base class so the CLI can catch any refusal-to-build and write nothing. */
export class BuildBlockedError extends Error {}

/** A residual secret survived redaction into a field that would be published. */
export class PrivacyGateError extends BuildBlockedError {
  constructor(readonly leakTypes: string[]) {
    super(`refusing to build receipt: residual secret(s) detected: ${leakTypes.join(", ")}`);
    this.name = "PrivacyGateError";
  }
}

/** A structural/label field did not meet its required shape. */
export class FieldRejectedError extends BuildBlockedError {
  constructor(field: string, reason: string) {
    super(`refusing to build receipt: field ${field} rejected — ${reason}`);
    this.name = "FieldRejectedError";
  }
}

export function assertKind(kind: string, where: string): void {
  if (!EVENT_KINDS.has(kind)) {
    throw new FieldRejectedError(`${where}.kind`, `not an allowed event kind: ${JSON.stringify(kind)}`);
  }
}

export function assertIssuedAt(s: string): void {
  if (!ISO_8601_UTC.test(s)) throw new FieldRejectedError("issuedAt", "not strict ISO-8601 UTC");
}

export function assertDate(s: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new FieldRejectedError(field, "must be YYYY-MM-DD");
}

export function assertCapsule(c: { id: string; version: string }): void {
  if (c.id.length > MAX_LABEL || !SLUG.test(c.id)) {
    throw new FieldRejectedError("capsule.id", "must be a lowercase slug ≤64 chars");
  }
  if (!/^[0-9]{1,8}$/.test(c.version)) {
    throw new FieldRejectedError("capsule.version", "must be a numeric string of 1–8 digits");
  }
}

/**
 * Redact a maker-authored free-text label and bound it (length + control
 * chars). Optionally enforce a closed vocabulary via `allow` — the only way to
 * actually guarantee a public label carries no secret (see SCOPE NOTE above).
 */
export function label(s: string, field: string, allow?: ReadonlySet<string>): string {
  const r = redactString(s).redacted;
  if (r.length > MAX_LABEL) throw new FieldRejectedError(field, `too long (>${MAX_LABEL} chars)`);
  if (CONTROL.test(r)) throw new FieldRejectedError(field, "contains control characters");
  if (allow && !allow.has(r)) throw new FieldRejectedError(field, `not in the allowed set`);
  return r;
}
