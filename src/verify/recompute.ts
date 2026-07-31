import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { sha256hex } from "../crypto.js";
import type { ArtifactCommitment, ArtifactKind, MachineMetric } from "../types.js";

// The heart of the thesis: metrics are *recomputed* from the committed artifact
// by whoever holds it — not asserted by the maker. Each adapter is what a
// `reexec-core` runner would satisfy.
//
// Determinism invariant: every check MUST be a pure function of the committed
// artifact bytes. Nothing may touch the surrounding filesystem, clock, or
// network — otherwise "independent recomputation from the artifact alone" is false.

export function recompute(kind: ArtifactKind, artifactPath: string): ArtifactCommitment {
  return kind === "swe" ? recomputeSwe(artifactPath) : recomputeWeb(artifactPath);
}

// ---------------------------------------------------------------------------
// web — syntactic checks over a single committed HTML file (Lighthouse stand-in)
// ---------------------------------------------------------------------------

export function recomputeWeb(artifactPath: string): ArtifactCommitment {
  const bytes = readFileSync(resolve(artifactPath));
  const commitment = sha256hex(bytes);
  const html = bytes.toString("utf8");
  const checks: MachineMetric[] = [
    metric("has_title", /<title>\s*\S[\s\S]*?<\/title>/i.test(html), "regex: non-empty <title>"),
    metric("has_viewport_meta", /<meta[^>]+name=["']viewport["']/i.test(html), "regex: viewport meta"),
    metric("has_lang_attr", /<html[^>]+\blang=/i.test(html), "regex: <html lang>"),
    metric("h1_count", countMatches(html, /<h1[\s>]/gi), "count of <h1>"),
    metric("img_alt_coverage", imgAltCoverage(html), "fraction of <img> with non-empty alt", "ratio"),
    metric("relative_asset_refs", countRelativeRefs(html), "count of relative href/src refs in the committed HTML"),
  ];
  return { kind: "web", commitment, checks };
}

// ---------------------------------------------------------------------------
// swe — re-run the committed test suite against the committed solution
// ---------------------------------------------------------------------------
//
// The bundle directory commits three files: solution.mjs (the deliverable),
// tests.mjs (the suite, imports solution.mjs), bundle.json ({ target, baseline }).
// The verifier re-executes the suite in an isolated child process with a timeout
// and recomputes: does the previously-failing TARGET test now pass, how many
// tests pass/fail, the pass rate, and regressions vs the committed baseline.
//
// SECURITY (Phase 0): this runs the maker's committed JS. It is isolated in a
// child process with a timeout, but a real deployment must sandbox it (container
// / seccomp). Do not run untrusted bundles outside a sandbox.

interface BundleMeta {
  target: string;
  baseline?: Record<string, boolean>;
}
interface RunResult {
  results: Array<{ name: string; pass: boolean; error?: string }>;
  fatal?: string;
}

export function recomputeSwe(bundlePath: string): ArtifactCommitment {
  const dir = resolve(bundlePath);
  const solutionPath = resolve(dir, "solution.mjs");
  const testsPath = resolve(dir, "tests.mjs");
  const metaPath = resolve(dir, "bundle.json");
  for (const p of [solutionPath, testsPath, metaPath]) {
    if (!existsSync(p)) throw new Error(`swe bundle missing ${p}`);
  }
  const solBytes = readFileSync(solutionPath);
  const testBytes = readFileSync(testsPath);
  const metaBytes = readFileSync(metaPath);
  const NUL = Buffer.from([0]);
  const commitment = sha256hex(Buffer.concat([solBytes, NUL, testBytes, NUL, metaBytes]));
  const meta = JSON.parse(metaBytes.toString("utf8")) as BundleMeta;

  const runnerPath = resolve(dirname(fileURLToPath(import.meta.url)), "swe-runner.mjs");
  const raw = execFileSync("node", [runnerPath, testsPath], { timeout: 10_000, encoding: "utf8" });
  const parsed = JSON.parse(raw) as RunResult;
  if (parsed.fatal) throw new Error(`swe suite failed to load: ${parsed.fatal}`);
  const results = parsed.results;

  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const target = results.find((r) => r.name === meta.target);
  const regressions = results.filter((r) => meta.baseline?.[r.name] === true && !r.pass).length;

  const checks: MachineMetric[] = [
    metric("target_test_passes", !!target?.pass, `re-ran suite; target "${meta.target}" now passes`),
    metric("tests_passed", passed, "count of passing tests on re-execution"),
    metric("tests_failed", total - passed, "count of failing tests on re-execution"),
    metric("pass_rate", total ? round(passed / total, 3) : 0, "passing / total on re-execution", "ratio"),
    metric("regressions", regressions, "tests passing in committed baseline that now fail"),
  ];
  return { kind: "swe", commitment, checks };
}

// ---------------------------------------------------------------------------

function metric(name: string, value: number | boolean, method: string, unit?: string): MachineMetric {
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
    if (/^(?:https?:|mailto:|tel:|data:|\/\/|#)/i.test(ref)) continue;
    refs.add(ref);
  }
  return refs.size;
}
function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
