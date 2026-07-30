import type { Receipt } from "../types.js";
import { canonicalize } from "../canonical.js";
import { verifyMessage } from "../crypto.js";
import { recomputeArtifact } from "../verify/recompute.js";
import { scan } from "../redact/scanner.js";

export interface CheckMismatch {
  name: string;
  claimed: unknown;
  recomputed: unknown;
}

export interface VerificationResult {
  /** ed25519 signature valid for the receipt's own verifier public key. */
  signatureValid: boolean;
  /** Artifact sha256 matches the committed one. */
  artifactMatch: boolean;
  /** Recomputed machine checks that disagree with the receipt. */
  checkMismatches: CheckMismatch[];
  /** No secret pattern appears anywhere in the receipt. */
  privacyClean: boolean;
  /** All of the above hold. */
  ok: boolean;
}

/**
 * Third-party verification. Given only the receipt and the artifact bytes,
 * anyone reproduces every machine claim and checks the signature — the maker is
 * never trusted to have told the truth.
 */
export function verifyReceipt(receipt: Receipt, artifactPath: string): VerificationResult {
  // 1. Signature over canonical(receipt without signature).
  const { signature, ...unsigned } = receipt;
  const signatureValid = verifyMessage(
    canonicalize(unsigned),
    signature,
    receipt.issuedBy.verifierPublicKey,
  );

  // 2. Independently recompute the artifact and compare.
  const fresh = recomputeArtifact(artifactPath);
  const artifactMatch = fresh.commitment === receipt.artifact.commitment;

  const claimedByName = new Map(receipt.artifact.checks.map((c) => [c.name, c.value]));
  const checkMismatches: CheckMismatch[] = [];
  for (const c of fresh.checks) {
    const claimed = claimedByName.get(c.name);
    if (claimed !== c.value) {
      checkMismatches.push({ name: c.name, claimed, recomputed: c.value });
    }
  }

  // 3. Privacy gate: the receipt must carry no secrets anywhere.
  const privacyClean = scan(canonicalize(receipt)).length === 0;

  const ok = signatureValid && artifactMatch && checkMismatches.length === 0 && privacyClean;
  return { signatureValid, artifactMatch, checkMismatches, privacyClean, ok };
}
