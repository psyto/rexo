import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildReceipt } from "../src/receipt/build.js";
import { verifyReceipt } from "../src/receipt/verify.js";
import { generateVerifierKey } from "../src/crypto.js";
import type { RawTrace } from "../src/types.js";

const raw = JSON.parse(readFileSync(resolve("fixtures/raw-trace.json"), "utf8")) as RawTrace;
const keyPair = generateVerifierKey();
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

describe("receipt build + verify", () => {
  it("a freshly built receipt verifies end-to-end", () => {
    const v = verifyReceipt(built.receipt, raw.artifactPath);
    expect(v.ok).toBe(true);
    expect(v.signatureValid).toBe(true);
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

  it("fails signature check if any signed field is tampered", () => {
    const tampered = structuredClone(built.receipt);
    tampered.execution.revisions = 99;
    const v = verifyReceipt(tampered, raw.artifactPath);
    expect(v.signatureValid).toBe(false);
    expect(v.ok).toBe(false);
  });

  it("fails artifact match if verified against different bytes", () => {
    const tamperedPath = resolve(SCRATCH, "tampered.html");
    writeFileSync(tamperedPath, "<!doctype html><html lang=ja><head><title>x</title></head><body><h1>x</h1></body></html>");
    const v = verifyReceipt(built.receipt, tamperedPath);
    expect(v.artifactMatch).toBe(false);
    expect(v.ok).toBe(false);
  });
});
