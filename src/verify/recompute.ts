import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
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
// The bundle directory commits the deliverable source (any number of .mjs files,
// e.g. solution.mjs or vault.mjs) plus tests.mjs (the suite, importing the
// deliverable) and bundle.json ({ target, baseline }). The commitment binds
// EVERY file in the bundle. The verifier re-executes the suite in an isolated
// child process with a timeout and recomputes: does the previously-failing
// TARGET test now pass, how many tests pass/fail, the pass rate, and regressions
// vs the committed baseline.
//
// SECURITY (Phase 0): this runs the maker's committed JS. It is isolated in a
// child process with a timeout, but a real deployment must sandbox it (container
// / seccomp). Do not run untrusted bundles outside a sandbox.

interface BundleMeta {
  target: string;
  baseline?: Record<string, boolean>;
  /** Provenance of the independent held-out suite (labels only). */
  heldout?: { author?: string; withheld?: boolean };
}
interface RunResult {
  results: Array<{ name: string; pass: boolean; error?: string }>;
  fatal?: string;
}

function runSuite(runnerPath: string, testsPath: string): RunResult {
  const raw = execFileSync("node", [runnerPath, testsPath], { timeout: 10_000, encoding: "utf8" });
  const parsed = JSON.parse(raw) as RunResult;
  if (parsed.fatal) throw new Error(`swe suite failed to load: ${parsed.fatal}`);
  return parsed;
}

export function recomputeSwe(bundlePath: string): ArtifactCommitment {
  const dir = resolve(bundlePath);
  const testsPath = resolve(dir, "tests.mjs");
  const metaPath = resolve(dir, "bundle.json");
  for (const p of [testsPath, metaPath]) {
    if (!existsSync(p)) throw new Error(`swe bundle missing ${p}`);
  }
  // Commitment binds every file in the bundle (name + bytes), sorted for
  // determinism — so multi-file deliverables (incl. heldout.mjs) are covered.
  const NUL = Buffer.from([0]);
  const names = readdirSync(dir)
    .filter((n) => statSync(resolve(dir, n)).isFile())
    .sort();
  const parts: Buffer[] = [];
  for (const n of names) {
    parts.push(Buffer.from(n, "utf8"), NUL, readFileSync(resolve(dir, n)), NUL);
  }
  const commitment = sha256hex(Buffer.concat(parts));
  const meta = JSON.parse(readFileSync(metaPath).toString("utf8")) as BundleMeta;

  const runnerPath = resolve(dirname(fileURLToPath(import.meta.url)), "swe-runner.mjs");

  // 1) the agent's OWN committed suite
  const results = runSuite(runnerPath, testsPath).results;
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

  // 2) the INDEPENDENT held-out suite (not authored by the agent) — the correctness
  //    signal beyond "the agent passed its own tests." ~28% of tests-passing patches
  //    are actually wrong (UTBoost); held-out tests catch those.
  const heldoutPath = resolve(dir, "heldout.mjs");
  const heldoutPresent = existsSync(heldoutPath);
  if (heldoutPresent) {
    const hr = runSuite(runnerPath, heldoutPath).results;
    const hPassed = hr.filter((r) => r.pass).length;
    const hAll = hr.length > 0 && hPassed === hr.length;
    const author = meta.heldout?.author ?? "independent";
    checks.push(
      metric("heldout_present", true, "an independent held-out suite is committed"),
      metric("heldout_tests_passed", hPassed, `held-out tests passing (author: ${author})`),
      metric("heldout_tests_failed", hr.length - hPassed, "independent held-out tests failing"),
      metric("heldout_all_pass", hAll, "all independent held-out tests pass"),
      metric(
        "correctness_tier",
        hAll ? "held-out-verified" : "held-out-FAILED",
        "strong = passed independent held-out tests; FAILED = passed own tests but not held-out",
      ),
    );
  } else {
    checks.push(
      metric("heldout_present", false, "no independent held-out suite — self-graded only"),
      metric(
        "correctness_tier",
        "committed-only",
        "weak: only the agent's own committed tests were re-run; not independently held-out",
      ),
    );
  }

  return { kind: "swe", commitment, checks };
}

// ---------------------------------------------------------------------------

function metric(name: string, value: number | boolean | string, method: string, unit?: string): MachineMetric {
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
