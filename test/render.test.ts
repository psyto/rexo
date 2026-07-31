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
  it("reads as a credential: verified quality signals, framed, not a linter dump", () => {
    expect(html).toContain("Verified Execution Credential");
    expect(html).toContain("独立に再計算された品質");
    expect(html).toContain("顧客データ露出");
    // humanized metric label, not the raw metric name
    expect(html).toContain("画像 alt 網羅率");
  });
});

describe("renderLocalComparison (device-only)", () => {
  const html = renderLocalComparison({ raw, receipt: built.receipt, findings: built.findings, verify });
  it("intentionally shows the raw secrets (hence must never leave the device)", () => {
    expect(html).toContain("sk-proj-ABCD1234abcd5678EFGH9012ijkl");
    expect(html).toContain("端末内でのみ閲覧");
  });
});

describe("renderProfile (verified track record / résumé)", () => {
  it("aggregates multiple credentials under one maker with roll-up stats", async () => {
    const { buildReceipt } = await import("../src/receipt/build.js");
    const { verifyReceipt } = await import("../src/receipt/verify.js");
    const { renderProfile } = await import("../src/receipt/render.js");
    const kp = keyPair;
    const fixtures = ["raw-trace-reckn-r1.json", "raw-trace-swe.json", "raw-trace-contract.json"];
    const entries = fixtures.map((f) => {
      const rt = JSON.parse(readFileSync(resolve("fixtures", f), "utf8")) as RawTrace;
      const b = buildReceipt(rt, { keyPair: kp });
      const v = verifyReceipt(b.receipt, rt.artifactPath, { trustedIssuer: kp.publicKey });
      return { receipt: b.receipt, verify: v };
    });
    const html = renderProfile(entries);
    expect(html).toContain("Verified Track Record");
    expect(html).toContain("Agent @aegis-swe"); // the AGENT is the subject
    expect(html).toContain("operated by @psyto"); // human operator = metadata
    expect(html).toContain("Experience"); // résumé section
    expect(html).toContain("証明された修正");
    expect(html).toContain("独立に検証済み"); // per-entry verified line
    // three swe fixes, all verified, zero regressions in the roll-up
    expect(entries.every((e) => e.verify.ok)).toBe(true);
    // no secret leaks into the aggregated page
    expect(html).not.toContain("sk-proj");
    expect(html).not.toContain("sk-ant");
  });
});
