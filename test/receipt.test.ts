import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildReceipt } from "../src/receipt/build.js";
import { verifyReceipt } from "../src/receipt/verify.js";
import { generateVerifierKey, signMessage } from "../src/crypto.js";
import { canonicalize } from "../src/canonical.js";
import type { RawTrace, Receipt } from "../src/types.js";

const raw = JSON.parse(readFileSync(resolve("fixtures/raw-trace.json"), "utf8")) as RawTrace;
const keyPair = generateVerifierKey();
const ISSUER = keyPair.publicKey;
const ART = raw.artifactPath;
const SCRATCH = resolve(
  "/private/tmp/claude-502/-Users-hiroyusai-src/9e31a867-991b-4c46-9262-389e90fab85f/scratchpad",
);

let built: ReturnType<typeof buildReceipt>;
beforeAll(() => {
  built = buildReceipt(raw, { keyPair, salt: "f".repeat(64), issuedAt: "2026-07-30T00:00:00Z" });
  mkdirSync(SCRATCH, { recursive: true });
});

const PLANTED = [
  "sk-proj-ABCD1234abcd5678EFGH9012ijkl",
  "AKIAABCDEFGHIJKLMNOP",
  "owner@sakura-diner.example",
  "03-1234-5678",
];

// Fully re-sign a mutated receipt (both the verifier and the agent signatures)
// with the SAME keys, so signature checks pass and the verify-layer logic is
// what's under test.
function reSign(r: Receipt): Receipt {
  const { signature: _s, agentSignature: _a, ...core } = r;
  const signature = signMessage(canonicalize(core), keyPair.privateKey);
  const withV = { ...core, signature };
  const agentSignature = signMessage(canonicalize(withV), built.agentKeyPair.privateKey);
  return { ...withV, agentSignature };
}

describe("receipt build + verify", () => {
  it("a freshly built receipt verifies end-to-end with a trusted issuer", () => {
    const v = verifyReceipt(built.receipt, ART, { trustedIssuer: ISSUER });
    expect(v.ok).toBe(true);
    expect(v.signatureValid).toBe(true);
    expect(v.issuerTrusted).toBe(true);
    expect(v.artifactMatch).toBe(true);
    expect(v.checkMismatches).toHaveLength(0);
    expect(v.privacyClean).toBe(true);
  });

  it("carries no planted secret anywhere in the receipt (privacy end-to-end)", () => {
    const blob = JSON.stringify(built.receipt);
    for (const secret of PLANTED) expect(blob).not.toContain(secret);
    expect(blob).not.toContain("rawText");
  });

  it("keeps the salt out of the public receipt", () => {
    expect(JSON.stringify(built.receipt)).not.toContain(built.salt);
    expect(built.receipt.saltCommitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("splits machine-recomputed (strong) from client-attested (weak)", () => {
    expect(built.receipt.metrics.machineRecomputed.every((m) => m.source === "recomputed")).toBe(true);
    const cvr = built.receipt.metrics.clientAttested.find((m) => m.name === "CVR");
    expect(cvr?.trust).toBe("low");
  });

  // anti-impersonation: the credential is bound to the agent's own key --------
  it("binds the credential to the agent's own key (valid authorship)", () => {
    const v = verifyReceipt(built.receipt, ART, { trustedIssuer: ISSUER, trustedAgent: built.agentKeyPair.publicKey });
    expect(v.agentSignatureValid).toBe(true);
    expect(v.agentTrusted).toBe(true);
    expect(v.ok).toBe(true);
  });
  it("cannot be re-homed onto a different agent identity", () => {
    const other = generateVerifierKey();
    const t = structuredClone(built.receipt);
    t.subject.agentKey = other.publicKey; // claim it's someone else's work
    const forged = reSign(t); // signed by the real agent key, not `other`
    const v = verifyReceipt(forged, ART, { trustedIssuer: ISSUER });
    expect(v.agentSignatureValid).toBe(false); // agent sig ≠ the claimed key
    expect(v.ok).toBe(false);
  });
  it("rejects a receipt whose agentKey is not the expected agent", () => {
    const v = verifyReceipt(built.receipt, ART, { trustedIssuer: ISSUER, trustedAgent: generateVerifierKey().publicKey });
    expect(v.agentTrusted).toBe(false);
    expect(v.ok).toBe(false);
  });

  // ---- finding #6: self-signed receipts need an out-of-band trust anchor ----
  it("does NOT pass without a trusted issuer, even with a valid signature", () => {
    const v = verifyReceipt(built.receipt, ART);
    expect(v.signatureValid).toBe(true);
    expect(v.issuerTrusted).toBe(false);
    expect(v.ok).toBe(false);
  });
  it("does NOT pass if the issuer key is not the trusted one", () => {
    const v = verifyReceipt(built.receipt, ART, { trustedIssuer: generateVerifierKey().publicKey });
    expect(v.issuerTrusted).toBe(false);
    expect(v.ok).toBe(false);
  });

  // ---- finding #4: the DISPLAYED machine metrics must be independently checked ----
  it("catches a re-signed receipt whose displayed machine metric was inflated", () => {
    const t = structuredClone(built.receipt);
    const h1 = t.metrics.machineRecomputed.find((m) => m.name === "h1_count")!;
    h1.value = 99; // pretend the page had 99 <h1>
    const forged = reSign(t);
    const v = verifyReceipt(forged, ART, { trustedIssuer: ISSUER });
    expect(v.signatureValid).toBe(true);
    expect(v.artifactMatch).toBe(true);
    expect(v.checkMismatches.some((m) => m.field === "metrics.machineRecomputed" && m.name === "h1_count")).toBe(true);
    expect(v.ok).toBe(false);
  });

  // ---- finding #3: __proto__ injection must not hide from sig + privacy ----
  it("rejects a __proto__-injected secret in the raw JSON", () => {
    const json = JSON.stringify(built.receipt);
    const injected = json.replace("{", `{"__proto__":"sk-proj-ZZZZ1234abcd5678EFGH9012ijkl",`);
    const parsed = JSON.parse(injected) as Receipt;
    const v = verifyReceipt(parsed, ART, { trustedIssuer: ISSUER, rawJson: injected });
    // canonicalize now preserves __proto__ → signature breaks; raw-bytes scan → privacy fails
    expect(v.signatureValid).toBe(false);
    expect(v.privacyClean).toBe(false);
    expect(v.ok).toBe(false);
  });

  // ---- finding #1: signature still catches ordinary tampering ----
  it("fails signature check if any signed field is tampered", () => {
    const t = structuredClone(built.receipt);
    t.execution.revisions = 99;
    const v = verifyReceipt(t, ART, { trustedIssuer: ISSUER });
    expect(v.signatureValid).toBe(false);
    expect(v.ok).toBe(false);
  });

  it("fails artifact match if verified against different bytes", () => {
    const tamperedPath = resolve(SCRATCH, "tampered.html");
    writeFileSync(tamperedPath, "<!doctype html><html lang=ja><head><title>x</title></head><body><h1>x</h1></body></html>");
    const v = verifyReceipt(built.receipt, tamperedPath, { trustedIssuer: ISSUER });
    expect(v.artifactMatch).toBe(false);
    expect(v.ok).toBe(false);
  });
});

describe("round 2 hardening", () => {
  // finding #1: structural public fields are validated, not scanner-trusted
  it("rejects a caller-supplied capsule id that is not a slug (e.g. mixed-case Base64)", () => {
    expect(() => buildReceipt(raw, { keyPair, capsule: { id: "c2stcHJvai1BQkNEMTIzNA", version: "1" } })).toThrow(/capsule\.id/);
  });
  it("rejects an arbitrary (non-enum) event kind", () => {
    const bad = structuredClone(raw);
    (bad.events[0] as { kind: string }).kind = "../secret";
    expect(() => buildReceipt(bad, { keyPair })).toThrow(/kind/);
  });
  it("rejects a non-ISO issuedAt", () => {
    expect(() => buildReceipt(raw, { keyPair, issuedAt: "yesterday" })).toThrow(/issuedAt/);
  });
  it("rejects an over-long public label", () => {
    const bad = structuredClone(raw);
    bad.job.category = "x".repeat(80);
    expect(() => buildReceipt(bad, { keyPair })).toThrow(/too long|category/);
  });

  // finding #2 (round 2): padded/duplicate machine metrics are caught
  it("catches duplicate/padded machine metrics even when a correct row is present", () => {
    const t = structuredClone(built.receipt);
    const h1 = t.metrics.machineRecomputed.find((m) => m.name === "h1_count")!;
    t.metrics.machineRecomputed.push({ ...h1, value: 99 });
    t.metrics.machineRecomputed.push({ ...h1 }); // displayed as 1, 99, 1
    const forged = reSign(t);
    const v = verifyReceipt(forged, ART, { trustedIssuer: ISSUER });
    expect(v.checkMismatches.length).toBeGreaterThan(0);
    expect(v.ok).toBe(false);
  });
});

describe("round 3 hardening", () => {
  // finding #2 (round 3): wire format pinned to canonical JSON
  it("accepts the exact canonical wire bytes", () => {
    const canonical = canonicalize(built.receipt);
    const v = verifyReceipt(JSON.parse(canonical) as Receipt, ART, { trustedIssuer: ISSUER, rawJson: canonical });
    expect(v.canonicalWire).toBe(true);
    expect(v.ok).toBe(true);
  });

  it("rejects a duplicate-key injection that a re-parse would hide", () => {
    // prepend a duplicate `capsule` carrying a Base64 secret; JSON.parse keeps
    // the later (legit) one, so signature stays valid — canonical wire must reject.
    const canonical = canonicalize(built.receipt);
    const injected = `{"capsule":{"id":"c2stcHjvai","version":"1"},` + canonical.slice(1);
    const parsed = JSON.parse(injected) as Receipt;
    const v = verifyReceipt(parsed, ART, { trustedIssuer: ISSUER, rawJson: injected });
    expect(v.signatureValid).toBe(true); // parsed value is the legit capsule
    expect(v.canonicalWire).toBe(false); // raw bytes are not canonical
    expect(v.ok).toBe(false);
    expect(injected).toContain("c2stcHjvai"); // the secret really is in the raw bytes
  });

  // finding #1 (round 3): capsule.version is bounded
  it("rejects an over-long capsule.version", () => {
    expect(() => buildReceipt(raw, { keyPair, capsule: { id: "ok-id", version: "123456789012345678" } })).toThrow(/version/);
  });
});
