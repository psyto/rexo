import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildReceipt } from "../src/receipt/build.js";
import { verifyReceipt } from "../src/receipt/verify.js";
import { renderPublishedReceipt, renderLocalComparison } from "../src/receipt/render.js";
import { generateVerifierKey } from "../src/crypto.js";
import type { RawTrace } from "../src/types.js";

const raw = JSON.parse(readFileSync(resolve("fixtures/raw-trace.json"), "utf8")) as RawTrace;
const keyPair = generateVerifierKey();
const built = buildReceipt(raw, { keyPair, salt: "a".repeat(64), issuedAt: "2026-07-30T00:00:00Z" });
const verify = verifyReceipt(built.receipt, raw.artifactPath, { trustedIssuer: keyPair.publicKey });

const PLANTED = [
  "sk-proj-ABCD1234abcd5678EFGH9012ijkl",
  "AKIAABCDEFGHIJKLMNOP",
  "owner@sakura-diner.example",
  "03-1234-5678",
  "さくら食堂のLP", // raw prompt fragment
];

describe("renderPublishedReceipt (safe to share)", () => {
  const html = renderPublishedReceipt(built.receipt, verify);
  it("contains no planted secret and no raw prompt text", () => {
    for (const s of PLANTED) expect(html).not.toContain(s);
  });
  it("does not embed any raw event/input text", () => {
    expect(html).not.toContain("<pre class=\"secret\">");
  });
  it("still shows the verified metrics and badges", () => {
    expect(html).toContain("機械再計算メトリクス");
    expect(html).toContain("issuer trusted");
  });
});

describe("renderLocalComparison (device-only)", () => {
  const html = renderLocalComparison({ raw, receipt: built.receipt, findings: built.findings, verify });
  it("intentionally shows the raw secrets (hence must never leave the device)", () => {
    expect(html).toContain("sk-proj-ABCD1234abcd5678EFGH9012ijkl");
    expect(html).toContain("端末内でのみ閲覧");
  });
});
