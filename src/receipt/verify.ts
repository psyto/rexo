import type { Receipt, MachineMetric } from "../types.js";
import { canonicalize } from "../canonical.js";
import { verifyMessage } from "../crypto.js";
import { recomputeArtifact } from "../verify/recompute.js";
import { scan } from "../redact/scanner.js";

export interface CheckMismatch {
  /** Which claimed array disagreed with the independent recomputation. */
  field: "artifact.checks" | "metrics.machineRecomputed";
  name: string;
  claimed: unknown;
  recomputed: unknown;
}

export interface VerifyOptions {
  /**
   * The public key of the independent verifier you trust, obtained out-of-band.
   * Without it a receipt is only self-signed (a maker can sign their own claims),
   * so `ok` cannot be true. See finding #6.
   */
  trustedIssuer?: string;
  /** Raw JSON bytes as received, scanned for secrets that a re-parse would hide. */
  rawJson?: string;
}

export interface VerificationResult {
  signatureValid: boolean;
  /** The receipt's issuer key matches a trusted issuer supplied out-of-band. */
  issuerTrusted: boolean;
  artifactMatch: boolean;
  /** Recomputed checks that disagree with either claimed array. */
  checkMismatches: CheckMismatch[];
  privacyClean: boolean;
  /** Raw wire bytes are exactly the canonical form — no dup keys / extra fields / reordering. */
  canonicalWire: boolean;
  ok: boolean;
}

/**
 * Third-party verification. Given the receipt, the artifact bytes, and the
 * trusted verifier's public key, anyone reproduces every machine claim and
 * checks the signature — the maker is never trusted to have told the truth, and
 * a self-signed receipt from an unknown key never passes.
 */
export function verifyReceipt(
  receipt: Receipt,
  artifactPath: string,
  opts: VerifyOptions = {},
): VerificationResult {
  // 1. Signature over canonical(receipt without signature).
  const { signature, ...unsigned } = receipt;
  const signatureValid = verifyMessage(
    canonicalize(unsigned),
    signature,
    receipt.issuedBy.verifierPublicKey,
  );

  // 2. Issuer authenticity: the signing key must be one we trust out-of-band.
  const issuerTrusted =
    !!opts.trustedIssuer && opts.trustedIssuer === receipt.issuedBy.verifierPublicKey;

  // 3. Independently recompute the artifact and compare BOTH claimed arrays —
  //    the one that's committed (artifact.checks) and the one that's displayed
  //    as "strong" (metrics.machineRecomputed). Both must equal the truth.
  const fresh = recomputeArtifact(artifactPath);
  const artifactMatch = fresh.commitment === receipt.artifact.commitment;
  const checkMismatches = [
    ...diffChecks(fresh.checks, receipt.artifact.checks, "artifact.checks"),
    ...diffChecks(fresh.checks, receipt.metrics.machineRecomputed, "metrics.machineRecomputed"),
  ];

  // 4. Wire format is pinned to canonical JSON. Any duplicate key, extra field,
  //    reordering, or whitespace makes the raw bytes differ from canonical and
  //    is rejected — this closes secret injection that a re-parse would hide
  //    (JSON.parse keeps only the last duplicate key) and that the scanner's
  //    false negatives would otherwise let through.
  const canonicalWire = opts.rawJson === undefined || opts.rawJson.trim() === canonicalize(receipt);

  // 5. Privacy gate: no secret anywhere in the canonical form, nor in the raw
  //    bytes as received (a `__proto__`-style injection hides from the parse).
  const privacyClean =
    scan(canonicalize(receipt)).length === 0 &&
    (opts.rawJson === undefined || scan(opts.rawJson).length === 0);

  const ok =
    signatureValid &&
    issuerTrusted &&
    artifactMatch &&
    checkMismatches.length === 0 &&
    canonicalWire &&
    privacyClean;
  return { signatureValid, issuerTrusted, artifactMatch, checkMismatches, privacyClean, canonicalWire, ok };
}

/**
 * Full equality of a claimed check array against the freshly recomputed one.
 * Strict: duplicate names and length mismatches are failures too — otherwise a
 * signer could pad the displayed array with extra rows (a correct value plus a
 * forged one) and slip past a name→value map that keeps only the last entry.
 */
function diffChecks(
  fresh: MachineMetric[],
  claimed: MachineMetric[],
  field: CheckMismatch["field"],
): CheckMismatch[] {
  const out: CheckMismatch[] = [];

  // Duplicate names in the claimed array are rejected outright.
  const counts = new Map<string, number>();
  for (const c of claimed) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  for (const [name, n] of counts) {
    if (n > 1) out.push({ field, name, claimed: `duplicate ×${n}`, recomputed: null });
  }

  // Array length must match the recomputed set exactly.
  if (claimed.length !== fresh.length) {
    out.push({ field, name: "(count)", claimed: claimed.length, recomputed: fresh.length });
  }

  const claimedByName = new Map(claimed.map((c) => [c.name, c]));
  const freshNames = new Set(fresh.map((c) => c.name));
  for (const f of fresh) {
    const c = claimedByName.get(f.name);
    if (!c || !sameMetric(f, c)) {
      out.push({ field, name: f.name, claimed: c ?? null, recomputed: f });
    }
  }
  for (const c of claimed) {
    if (!freshNames.has(c.name)) {
      out.push({ field, name: c.name, claimed: c, recomputed: null });
    }
  }
  return out;
}

function sameMetric(a: MachineMetric, b: MachineMetric): boolean {
  return (
    a.name === b.name &&
    a.value === b.value &&
    a.unit === b.unit &&
    a.method === b.method &&
    a.source === b.source
  );
}
