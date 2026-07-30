import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256hex } from "../crypto.js";
import type { ArtifactCommitment, MachineMetric } from "../types.js";

// The heart of the thesis: metrics are *recomputed* from the committed artifact
// by whoever holds it — not asserted by the maker. This stands in for a
// Lighthouse/link-check runner; the interface is what a `reexec-core` adapter
// would satisfy.
//
// Determinism invariant: every check MUST be a pure function of the committed
// artifact bytes. Nothing may touch the surrounding filesystem, clock, or
// network — otherwise the same committed bytes could yield different metrics on
// a different machine, and "independent recomputation from the artifact alone"
// would be false. (An earlier `broken_relative_links` check `existsSync`'d
// sibling files that were not part of the commitment; it is replaced here by a
// pure count of relative references. A real multi-file artifact should commit
// to a bundle root and be checked inside that bundle.)

export function recomputeArtifact(artifactPath: string): ArtifactCommitment {
  const bytes = readFileSync(resolve(artifactPath));
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
      "relative_asset_refs",
      countRelativeRefs(html),
      "count of relative href/src references in the committed HTML bytes",
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

function countRelativeRefs(html: string): number {
  const refs = new Set<string>();
  const re = /(?:href|src)=["']([^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const ref = m[1];
    if (!ref) continue;
    if (/^(?:https?:|mailto:|tel:|data:|\/\/|#)/i.test(ref)) continue; // external/anchor
    refs.add(ref);
  }
  return refs.size;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
