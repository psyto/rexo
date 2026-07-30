import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { RawTrace, Receipt } from "./types.js";
import { buildReceipt, PrivacyGateError } from "./receipt/build.js";
import { verifyReceipt, type VerificationResult } from "./receipt/verify.js";
import { renderPublishedReceipt, renderLocalComparison } from "./receipt/render.js";
import { generateVerifierKey, type KeyPair } from "./crypto.js";

// Phase-0 CLI.
//   build   — RawTrace fixture → receipt.json + receipt.html (PUBLISH-SAFE).
//             `--local-preview` also writes vault/receipt.local.html (SECRETS).
//   verify  — receipt.json + artifact + trusted issuer key → verification result.

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function loadKey(outDir: string): KeyPair {
  const keyPath = resolve(outDir, "verifier-key.json");
  if (existsSync(keyPath)) return JSON.parse(readFileSync(keyPath, "utf8")) as KeyPair;
  const kp = generateVerifierKey();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(keyPath, JSON.stringify(kp, null, 2));
  return kp;
}

function cmdBuild(): void {
  const fixture = arg("--fixture", "fixtures/raw-trace.json")!;
  const outDir = arg("--out", "out")!;
  const raw = JSON.parse(readFileSync(resolve(fixture), "utf8")) as RawTrace;
  const keyPair = loadKey(outDir);

  let result;
  try {
    result = buildReceipt(raw, { keyPair });
  } catch (e) {
    if (e instanceof PrivacyGateError) {
      console.error(`BUILD BLOCKED — ${e.message}`);
      console.error("nothing written. redact the offending field and retry.");
      process.exitCode = 1;
      return;
    }
    throw e;
  }
  const { receipt, salt, findings } = result;

  // The tool's own verifier key is the trust anchor for a self-issued build.
  const verify = verifyReceipt(receipt, raw.artifactPath, { trustedIssuer: keyPair.publicKey });
  if (!verify.privacyClean) {
    console.error("BUILD BLOCKED — privacy check failed post-build. nothing written.");
    process.exitCode = 1;
    return;
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "receipt.json"), JSON.stringify(receipt, null, 2));
  writeFileSync(resolve(outDir, "receipt.html"), renderPublishedReceipt(receipt, verify));
  // Salt envelope stays device-local; out/ is gitignored.
  writeFileSync(resolve(outDir, "envelope.local.json"), JSON.stringify({ salt }, null, 2));
  console.log(`built → ${outDir}/receipt.json, receipt.html (publish-safe)`);
  console.log(`redaction findings: ${findings.length} secret(s) stripped`);

  if (has("--local-preview")) {
    const vault = resolve("vault");
    mkdirSync(vault, { recursive: true });
    writeFileSync(resolve(vault, "receipt.local.html"), renderLocalComparison({ raw, receipt, findings, verify }));
    console.log("⚠ wrote vault/receipt.local.html — contains secrets, do NOT share/commit");
  }
  console.log(printVerify(verify));
}

function cmdVerify(): void {
  const receiptPath = arg("--receipt", "out/receipt.json")!;
  const rawJson = readFileSync(resolve(receiptPath), "utf8");
  const receipt = JSON.parse(rawJson) as Receipt;
  const artifact = arg("--artifact", "fixtures/artifact/index.html")!;

  // Trusted issuer must come from out-of-band knowledge of the verifier, not the
  // receipt itself. Default: the local verifier-key.json the tool issued with.
  let trustedIssuer = arg("--issuer");
  if (!trustedIssuer) {
    const keyPath = resolve(arg("--out", "out")!, "verifier-key.json");
    if (existsSync(keyPath)) trustedIssuer = (JSON.parse(readFileSync(keyPath, "utf8")) as KeyPair).publicKey;
  }
  if (!trustedIssuer) console.error("note: no --issuer trust anchor supplied → issuer cannot be trusted");

  const result = verifyReceipt(receipt, artifact, { trustedIssuer, rawJson });
  console.log(printVerify(result));
  if (!result.ok) process.exitCode = 1;
}

function printVerify(v: VerificationResult): string {
  const b = (ok: boolean) => (ok ? "PASS" : "FAIL");
  return [
    `verification: ${v.ok ? "OK" : "FAILED"}`,
    `  signature      ${b(v.signatureValid)}`,
    `  issuer trusted ${b(v.issuerTrusted)}`,
    `  artifact match ${b(v.artifactMatch)}`,
    `  machine checks ${b(v.checkMismatches.length === 0)}${v.checkMismatches.length ? " — " + v.checkMismatches.map((m) => `${m.field}:${m.name}`).join(", ") : ""}`,
    `  privacy clean  ${b(v.privacyClean)}`,
  ].join("\n");
}

const cmd = process.argv[2];
if (cmd === "build") cmdBuild();
else if (cmd === "verify") cmdVerify();
else {
  console.error("usage: tsx src/cli.ts <build|verify> [--fixture f] [--out d] [--receipt r] [--artifact a] [--issuer b64] [--local-preview]");
  process.exitCode = 2;
}
