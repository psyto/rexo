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

  // 4. Privacy gate: no secret anywhere in the canonical form, nor in the raw
  //    bytes as received (a `__proto__`-style injection hides from the parse).
  const privacyClean =
    scan(canonicalize(receipt)).length === 0 &&
    (opts.rawJson === undefined || scan(opts.rawJson).length === 0);

  const ok =
    signatureValid && issuerTrusted && artifactMatch && checkMismatches.length === 0 && privacyClean;
  return { signatureValid, issuerTrusted, artifactMatch, checkMismatches, privacyClean, ok };
}

/** Full equality of a claimed check array against the freshly recomputed one. */
function diffChecks(
  fresh: MachineMetric[],
  claimed: MachineMetric[],
  field: CheckMismatch["field"],
): CheckMismatch[] {
  const out: CheckMismatch[] = [];
  const claimedByName = new Map(claimed.map((c) => [c.name, c]));
  const freshNames = new Set(fresh.map((c) => c.name));

  for (const f of fresh) {
    const c = claimedByName.get(f.name);
    if (!c || !sameMetric(f, c)) {
      out.push({ field, name: f.name, claimed: c ?? null, recomputed: f });
    }
  }
  // Extra claimed metrics with no recomputed counterpart are also failures.
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
