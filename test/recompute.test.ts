import { describe, it, expect } from "vitest";
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
    // hero.jpg + dish.jpg are referenced but absent → 2 broken
    expect(check("broken_relative_links", checks)).toBe(2);
  });
});
