import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { sha256hex } from "../crypto.js";
import type { ArtifactCommitment, MachineMetric } from "../types.js";

// The heart of the thesis: metrics are *recomputed* from the committed artifact
// by whoever holds the artifact — not asserted by the maker. This stands in for
// a Lighthouse/link-check runner; the interface is what a `reexec-core` adapter
// would satisfy. Same bytes in → same metrics out (deterministic), so a third
// party reproduces the exact same commitment and checks.

export function recomputeArtifact(artifactPath: string): ArtifactCommitment {
  const abs = resolve(artifactPath);
  const bytes = readFileSync(abs);
  const commitment = sha256hex(bytes);
  const html = bytes.toString("utf8");
  const checks: MachineMetric[] = [
    metric("has_title", /<title>\s*\S[\s\S]*?<\/title>/i.test(html), "regex: non-empty <title>"),
    metric("has_viewport_meta", /<meta[^>]+name=["']viewport["']/i.test(html), "regex: viewport meta"),
    metric("has_lang_attr", /<html[^>]+\blang=/i.test(html), "regex: <html lang>"),
    metric("h1_count", countMatches(html, /<h1[\s>]/gi), "count of <h1>"),
    metric(
      "img_alt_coverage",
      imgAltCoverage(html),
      "fraction of <img> tags with a non-empty alt attribute",
      "ratio",
    ),
    metric(
      "broken_relative_links",
      countBrokenRelativeLinks(html, dirname(abs)),
      "href/src to local files that do not exist on disk",
    ),
  ];
  return { commitment, checks };
}

function metric(
  name: string,
  value: number | boolean,
  method: string,
  unit?: string,
): MachineMetric {
  return { name, value, source: "recomputed", method, ...(unit ? { unit } : {}) };
}

function countMatches(s: string, re: RegExp): number {
  return (s.match(re) ?? []).length;
}

function imgAltCoverage(html: string): number {
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  if (imgs.length === 0) return 1;
  const withAlt = imgs.filter((t) => /\balt=["'][^"']*\S[^"']*["']/i.test(t)).length;
  return round(withAlt / imgs.length, 3);
}

function countBrokenRelativeLinks(html: string, baseDir: string): number {
  const refs = new Set<string>();
  const re = /(?:href|src)=["']([^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const ref = m[1];
    if (!ref) continue;
    if (/^(?:https?:|mailto:|tel:|data:|\/\/|#)/i.test(ref)) continue; // external/anchor
    refs.add(ref);
  }
  let broken = 0;
  for (const ref of refs) {
    if (!existsSync(resolve(baseDir, ref))) broken++;
  }
  return broken;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
