import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { redactTrace } from "../src/redact/redact.js";
import { canonicalize } from "../src/canonical.js";
import type { RawTrace } from "../src/types.js";

const raw = JSON.parse(
  readFileSync(resolve("fixtures/raw-trace.json"), "utf8"),
) as RawTrace;

const PLANTED = [
  "sk-proj-ABCD1234abcd5678EFGH9012ijkl",
  "AKIAABCDEFGHIJKLMNOP",
  "owner@sakura-diner.example",
  "03-1234-5678",
];

describe("redactTrace", () => {
  const { published, findings, inputKinds } = redactTrace(raw);

  it("strips rawText — no published event carries a rawText field", () => {
    for (const ev of published) {
      expect(Object.prototype.hasOwnProperty.call(ev, "rawText")).toBe(false);
    }
  });

  it("leaks no planted secret into the published side", () => {
    const blob = canonicalize(published) + canonicalize(inputKinds);
    for (const secret of PLANTED) {
      expect(blob).not.toContain(secret);
    }
  });

  it("reports findings by location without echoing the secret value", () => {
    expect(findings.length).toBeGreaterThanOrEqual(PLANTED.length);
    const dump = JSON.stringify(findings);
    for (const secret of PLANTED) {
      expect(dump).not.toContain(secret);
    }
  });

  it("exposes only input kinds, never input contents", () => {
    expect(inputKinds).toEqual(expect.arrayContaining(["brief", "brand-assets"]));
    expect(canonicalize(inputKinds)).not.toContain("さくら食堂");
  });
});
