import { describe, it, expect } from "vitest";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { recompute } from "../src/verify/recompute.js";
import type { ArtifactCommitment } from "../src/types.js";

const ARTIFACT = "fixtures/artifact/index.html";

function check(name: string, checks: ArtifactCommitment["checks"]) {
  const m = checks.find((c) => c.name === name);
  if (!m) throw new Error(`missing metric ${name}`);
  return m.value;
}

describe("recompute web", () => {
  it("is deterministic — same bytes in, same commitment and checks out", () => {
    const a = recompute("web", ARTIFACT);
    const b = recompute("web", ARTIFACT);
    expect(a.commitment).toBe(b.commitment);
    expect(a.checks).toEqual(b.checks);
    expect(a.commitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("recomputes honest metrics the maker cannot fake", () => {
    const { checks } = recompute("web", ARTIFACT);
    expect(check("has_title", checks)).toBe(true);
    expect(check("has_viewport_meta", checks)).toBe(true);
    expect(check("has_lang_attr", checks)).toBe(true);
    expect(check("h1_count", checks)).toBe(1);
    // one of two <img> has alt → 0.5
    expect(check("img_alt_coverage", checks)).toBe(0.5);
    // hero.jpg + dish.jpg are relative refs → 2 (pure count, no filesystem)
    expect(check("relative_asset_refs", checks)).toBe(2);
  });

  it("depends only on the committed bytes, not the surrounding filesystem", () => {
    // Same bytes verified from a directory with different siblings must not
    // change any metric (the fix for finding #5).
    const original = recompute("web", ARTIFACT);
    const copyDir = resolve(
      "/private/tmp/claude-502/-Users-hiroyusai-src/9e31a867-991b-4c46-9262-389e90fab85f/scratchpad/recompute-iso",
    );
    mkdirSync(copyDir, { recursive: true });
    const copyPath = resolve(copyDir, "index.html");
    copyFileSync(ARTIFACT, copyPath);
    // Place the referenced siblings next to the copy — under the old check this
    // flipped broken links 2→0; now it must not move any metric.
    writeFileSync(resolve(copyDir, "hero.jpg"), "x");
    writeFileSync(resolve(copyDir, "dish.jpg"), "x");
    const moved = recompute("web", copyPath);
    expect(moved.commitment).toBe(original.commitment);
    expect(moved.checks).toEqual(original.checks);
  });
});

describe("recompute swe", () => {
  const BUNDLE = "fixtures/swe-bundle";

  it("re-runs the committed suite and recomputes honest results", () => {
    const a = recompute("swe", BUNDLE);
    const b = recompute("swe", BUNDLE);
    expect(a.commitment).toBe(b.commitment); // deterministic
    expect(a.commitment).toMatch(/^[0-9a-f]{64}$/);
    expect(a.kind).toBe("swe");
    expect(check("target_test_passes", a.checks)).toBe(true);
    expect(check("tests_passed", a.checks)).toBe(5);
    expect(check("tests_failed", a.checks)).toBe(0);
    expect(check("pass_rate", a.checks)).toBe(1);
    expect(check("regressions", a.checks)).toBe(0);
  });

  it("catches a broken deliverable: target fails and a regression is counted", () => {
    const dir = resolve(
      "/private/tmp/claude-502/-Users-hiroyusai-src/9e31a867-991b-4c46-9262-389e90fab85f/scratchpad/swe-broken",
    );
    mkdirSync(dir, { recursive: true });
    // solution that drops the zero branch (target fails) AND breaks negatives (regression)
    writeFileSync(
      resolve(dir, "solution.mjs"),
      "export function add(a,b){return a+1;}\nexport function classify(n){return n<0?'negative':'positive';}\n",
    );
    copyFileSync(resolve(BUNDLE, "tests.mjs"), resolve(dir, "tests.mjs"));
    copyFileSync(resolve(BUNDLE, "bundle.json"), resolve(dir, "bundle.json"));
    const r = recompute("swe", dir);
    expect(check("target_test_passes", r.checks)).toBe(false);
    expect(Number(check("regressions", r.checks))).toBeGreaterThanOrEqual(1);
    expect(Number(check("tests_failed", r.checks))).toBeGreaterThanOrEqual(1);
  });
});

describe("recompute swe — contract remediation (same adapter)", () => {
  const BUNDLE = "fixtures/contract-bundle";
  it("proves the exploit is closed and invariants hold, via re-execution", () => {
    const r = recompute("swe", BUNDLE);
    expect(r.kind).toBe("swe");
    // target = the exploit test; passes only when the vulnerability is patched
    expect(check("target_test_passes", r.checks)).toBe(true);
    expect(check("tests_passed", r.checks)).toBe(4);
    expect(check("tests_failed", r.checks)).toBe(0);
    // no invariant that held in the baseline now fails
    expect(check("regressions", r.checks)).toBe(0);
  });
});
