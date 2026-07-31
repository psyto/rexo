// Core types for the Phase-0 Receipt slice.
//
// Invariant: the PUBLISHED side of every type must be secret-free. Raw prompts,
// raw model output, client materials, keys — these live only on the RAW side
// (device-local vault) and must never appear in a Receipt or PublishedTrace.

export type EventKind = "llm_call" | "tool_call" | "edit" | "eval";

/** Device-local, secret-capable. Never published verbatim. */
export interface RawEvent {
  kind: EventKind;
  tool?: string;
  /** Raw prompt/output/notes. Secret-capable. Stripped before publication. */
  rawText?: string;
  /** Optional human summary the maker wrote; still scanned before publishing. */
  summary?: string;
  costUsd?: number;
  durationMs?: number;
}

/** Client-attested outcome (e.g. CVR). NOT independently recomputable. Low trust. */
export interface AttestedMetric {
  name: string;
  value: number | string;
  unit?: string;
  /** Opaque attestation reference (e.g. a client signature id). Never a secret. */
  attestation?: string;
}

/** A completed job as captured on the maker's device. Secret-capable. */
export interface RawTrace {
  job: {
    id: string;
    /** Coarse category only, e.g. "restaurant-lp". No client identifiers. */
    category: string;
    domain?: string;
    /** Human, résumé-style headline for this credential (public label). */
    title?: string;
    /** Completion date, YYYY-MM-DD — the experience date on the résumé. */
    date?: string;
  };
  events: RawEvent[];
  /** Raw client inputs (brief, copy, assets). Secret-capable. */
  inputs?: Array<{ kind: string; rawText?: string }>;
  /** The AI agent this job's credential belongs to (a handle) — the subject. */
  agent?: string;
  /** The human/org operating the agent (metadata, not the subject). */
  operator?: string;
  /** Which recompute adapter to use. Defaults to "web". */
  artifactKind?: ArtifactKind;
  /** Local path to the delivered artifact: a file (web) or a bundle dir (swe). */
  artifactPath: string;
  /** Outcome metrics the client attests to. Carried as low-trust. */
  attestedMetrics?: AttestedMetric[];
  revisions?: number;
}

// ---------------------------------------------------------------------------
// Published side — secret-free by construction. No `rawText` field exists here.
// ---------------------------------------------------------------------------

export interface PublishedEvent {
  kind: EventKind;
  tool?: string;
  /** Redacted, secret-free summary. */
  redactedSummary: string;
}

/** A metric the verifier recomputed independently from committed artifacts. */
export interface MachineMetric {
  name: string;
  value: number | string | boolean;
  unit?: string;
  source: "recomputed";
  /** How it was computed, so a third party can reproduce it. */
  method: string;
}

export type ArtifactKind = "web" | "swe";

export interface ArtifactCommitment {
  /** Which recompute adapter produced/validates this. Self-describing for verify. */
  kind: ArtifactKind;
  /** sha256 of the committed artifact bytes (single file, or the swe bundle). */
  commitment: string;
  checks: MachineMetric[];
}

export type CostBand = "<$1" | "$1–10" | "$10–100" | ">$100";
export type DurationBand = "<1m" | "1–10m" | "10–60m" | ">1h" | "unknown";

export interface Receipt {
  schema: "ccap.receipt/v0";
  /** The subject whose track record this credential belongs to — an AI agent,
   *  with the operating human/org as metadata. */
  subject: { kind: "agent"; agentId: string; operator?: string };
  capsule: { id: string; version: string };
  conditions: {
    category: string;
    domain?: string;
    /** Kinds of inputs involved, categories only — never the inputs themselves. */
    inputKinds: string[];
  };
  /** Résumé-style headline for this credential (maker-authored public label). */
  title?: string;
  /** Completion date, YYYY-MM-DD. */
  completedAt?: string;
  toolsUsed: string[];
  execution: {
    revisions: number;
    costBand: CostBand;
    durationBand: DurationBand;
  };
  artifact: ArtifactCommitment;
  metrics: {
    /** Independently recomputed → cannot be forged by the maker. Strong. */
    machineRecomputed: MachineMetric[];
    /** Client-attested (e.g. CVR). Cannot be recomputed here. Weak, low-trust. */
    clientAttested: Array<AttestedMetric & { source: "client-attested"; trust: "low" }>;
  };
  publishedTrace: PublishedEvent[];
  /** sha256(salt || canonical(coreClaims)) — hides short claims from guessing. */
  saltCommitment: string;
  issuedAt: string;
  issuedBy: { verifierPublicKey: string };
  /** ed25519 over canonical(receipt without `signature`). */
  signature: string;
}

export interface Finding {
  type: string;
  /** Where it was found, e.g. "events[2].rawText". Never includes the secret. */
  location: string;
}
