import type {
  RawTrace,
  Receipt,
  CostBand,
  DurationBand,
  Finding,
} from "../types.js";
import { redactTrace } from "../redact/redact.js";
import { recomputeArtifact } from "../verify/recompute.js";
import { canonicalize } from "../canonical.js";
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

export function buildReceipt(raw: RawTrace, opts: BuildOptions = {}): BuildResult {
  const keyPair = opts.keyPair ?? generateVerifierKey();
  const salt = opts.salt ?? randomSalt();
  const issuedAt = opts.issuedAt ?? new Date().toISOString();

  const { published, inputKinds, findings } = redactTrace(raw);
  const artifact = recomputeArtifact(raw.artifactPath);

  const toolsUsed = dedupe(
    raw.events.flatMap((e) => (e.tool ? [e.tool] : [])),
  );
  const revisions = raw.revisions ?? raw.events.filter((e) => e.kind === "edit").length;
  const costBand = toCostBand(sum(raw.events.map((e) => e.costUsd ?? 0)));
  const durationBand = toDurationBand(sum(raw.events.map((e) => e.durationMs ?? 0)));

  const clientAttested = (raw.attestedMetrics ?? []).map((m) => ({
    ...m,
    source: "client-attested" as const,
    trust: "low" as const,
  }));

  // Core claims are what the salt commitment binds. Kept separate from
  // presentation fields so the commitment is stable and meaningful.
  const coreClaims = {
    conditions: { category: raw.job.category, domain: raw.job.domain, inputKinds },
    toolsUsed,
    execution: { revisions, costBand, durationBand },
    artifact,
    machineRecomputed: artifact.checks,
    clientAttested,
  };
  const saltCommitment = sha256hex(salt + canonicalize(coreClaims));

  const unsigned: Omit<Receipt, "signature"> = {
    schema: "ccap.receipt/v0",
    capsule: opts.capsule ?? { id: raw.job.id, version: "1" },
    conditions: coreClaims.conditions,
    toolsUsed,
    execution: coreClaims.execution,
    artifact,
    metrics: { machineRecomputed: artifact.checks, clientAttested },
    publishedTrace: published,
    saltCommitment,
    issuedAt,
    issuedBy: { verifierPublicKey: keyPair.publicKey },
  };

  const signature = signMessage(canonicalize(unsigned), keyPair.privateKey);
  return { receipt: { ...unsigned, signature }, salt, keyPair, findings };
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
