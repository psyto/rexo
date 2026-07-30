import type { RawTrace, Receipt, CostBand, DurationBand, Finding, AttestedMetric } from "../types.js";
import { redactTrace } from "../redact/redact.js";
import { recomputeArtifact } from "../verify/recompute.js";
import { canonicalize } from "../canonical.js";
import { scan, redactString } from "../redact/scanner.js";
import { sha256hex, randomSalt, signMessage, generateVerifierKey, type KeyPair } from "../crypto.js";

export interface BuildOptions {
  keyPair?: KeyPair;
  /** Injectable for deterministic tests. */
  salt?: string;
  issuedAt?: string;
  capsule?: { id: string; version: string };
}

export interface BuildResult {
  receipt: Receipt;
  /** Kept device-local (not in the receipt). Reveal with a claim for selective disclosure. */
  salt: string;
  keyPair: KeyPair;
  findings: Finding[];
}

/** A residual secret survived redaction into a field that would be published. */
export class PrivacyGateError extends Error {
  constructor(readonly leakTypes: string[]) {
    super(`refusing to build receipt: residual secret(s) detected: ${leakTypes.join(", ")}`);
    this.name = "PrivacyGateError";
  }
}

const red = (s: string): string => redactString(s).redacted;

export function buildReceipt(raw: RawTrace, opts: BuildOptions = {}): BuildResult {
  const keyPair = opts.keyPair ?? generateVerifierKey();
  const salt = opts.salt ?? randomSalt();
  const issuedAt = opts.issuedAt ?? new Date().toISOString();

  const { published, inputKinds, findings } = redactTrace(raw);
  const artifact = recomputeArtifact(raw.artifactPath);

  // Every external-origin string that lands in the receipt is redacted — not
  // just event summaries. The scanner is best-effort; the final gate below is
  // what actually guarantees no secret ships.
  const toolsUsed = dedupe(raw.events.flatMap((e) => (e.tool ? [red(e.tool)] : [])));
  const revisions = raw.revisions ?? raw.events.filter((e) => e.kind === "edit").length;
  const costBand = toCostBand(sum(raw.events.map((e) => e.costUsd ?? 0)));
  const durationBand = toDurationBand(sum(raw.events.map((e) => e.durationMs ?? 0)));

  const clientAttested = (raw.attestedMetrics ?? []).map((m) => redactAttested(m));

  const conditions = {
    category: red(raw.job.category),
    ...(raw.job.domain ? { domain: red(raw.job.domain) } : {}),
    inputKinds,
  };

  // Core claims are what the salt commitment binds — kept separate from
  // presentation fields so the commitment is stable and meaningful.
  const coreClaims = { conditions, toolsUsed, execution: { revisions, costBand, durationBand }, artifact, machineRecomputed: artifact.checks, clientAttested };
  const saltCommitment = sha256hex(salt + canonicalize(coreClaims));

  const unsigned: Omit<Receipt, "signature"> = {
    schema: "ccap.receipt/v0",
    capsule: opts.capsule ?? { id: red(raw.job.id), version: "1" },
    conditions,
    toolsUsed,
    execution: { revisions, costBand, durationBand },
    artifact,
    metrics: { machineRecomputed: artifact.checks, clientAttested },
    publishedTrace: published,
    saltCommitment,
    issuedAt,
    issuedBy: { verifierPublicKey: keyPair.publicKey },
  };

  const signature = signMessage(canonicalize(unsigned), keyPair.privateKey);
  const receipt: Receipt = { ...unsigned, signature };

  // Fail closed: if anything secret still shows up anywhere in the receipt,
  // refuse to return it. Callers must never write an unbuilt receipt.
  const residual = scan(canonicalize(receipt));
  if (residual.length > 0) {
    throw new PrivacyGateError(dedupe(residual.map((r) => r.type)));
  }

  return { receipt, salt, keyPair, findings };
}

function redactAttested(m: AttestedMetric): AttestedMetric & { source: "client-attested"; trust: "low" } {
  return {
    name: red(m.name),
    value: typeof m.value === "string" ? red(m.value) : m.value,
    ...(m.unit ? { unit: red(m.unit) } : {}),
    ...(m.attestation ? { attestation: red(m.attestation) } : {}),
    source: "client-attested",
    trust: "low",
  };
}

function toCostBand(usd: number): CostBand {
  if (usd < 1) return "<$1";
  if (usd < 10) return "$1–10";
  if (usd < 100) return "$10–100";
  return ">$100";
}

function toDurationBand(ms: number): DurationBand {
  if (ms <= 0) return "unknown";
  const min = ms / 60000;
  if (min < 1) return "<1m";
  if (min < 10) return "1–10m";
  if (min < 60) return "10–60m";
  return ">1h";
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}
