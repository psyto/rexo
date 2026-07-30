import { describe, it, expect } from "vitest";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { recomputeArtifact } from "../src/verify/recompute.js";

const ARTIFACT = "fixtures/artifact/index.html";

function check(name: string, checks: ReturnType<typeof recomputeArtifact>["checks"]) {
  const m = checks.find((c) => c.name === name);
  if (!m) throw new Error(`missing metric ${name}`);
  return m.value;
}

describe("recomputeArtifact", () => {
  it("is deterministic — same bytes in, same commitment and checks out", () => {
    const a = recomputeArtifact(ARTIFACT);
    const b = recomputeArtifact(ARTIFACT);
    expect(a.commitment).toBe(b.commitment);
    expect(a.checks).toEqual(b.checks);
    expect(a.commitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("recomputes honest metrics the maker cannot fake", () => {
    const { checks } = recomputeArtifact(ARTIFACT);
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
    const original = recomputeArtifact(ARTIFACT);
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
    const moved = recomputeArtifact(copyPath);
    expect(moved.commitment).toBe(original.commitment);
    expect(moved.checks).toEqual(original.checks);
  });
});
