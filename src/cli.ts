import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { RawTrace, Receipt } from "./types.js";
import { buildReceipt } from "./receipt/build.js";
import { verifyReceipt } from "./receipt/verify.js";
import { renderBeforeAfter } from "./receipt/render.js";
import { generateVerifierKey, type KeyPair } from "./crypto.js";

// Phase-0 CLI. Two commands:
//   build   — RawTrace fixture → receipt.json + envelope.json (salt) + receipt.html
//   verify  — receipt.json + artifact → independent verification result

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function loadKey(outDir: string): KeyPair {
  const keyPath = resolve(outDir, "verifier-key.json");
  if (existsSync(keyPath)) {
    return JSON.parse(readFileSync(keyPath, "utf8")) as KeyPair;
  }
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

  const { receipt, salt, findings } = buildReceipt(raw, { keyPair });
  const verify = verifyReceipt(receipt, raw.artifactPath);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "receipt.json"), JSON.stringify(receipt, null, 2));
  // The salt envelope stays device-local — it is NOT part of the public receipt.
  writeFileSync(resolve(outDir, "envelope.local.json"), JSON.stringify({ salt }, null, 2));
  writeFileSync(resolve(outDir, "receipt.html"), renderBeforeAfter({ raw, receipt, findings, verify }));

  console.log(`built → ${outDir}/receipt.json, receipt.html`);
  console.log(`redaction findings: ${findings.length} secret(s) stripped`);
  console.log(printVerify(verify));
}

function cmdVerify(): void {
  const receiptPath = arg("--receipt", "out/receipt.json")!;
  const receipt = JSON.parse(readFileSync(resolve(receiptPath), "utf8")) as Receipt;
  const artifact = arg("--artifact", "fixtures/artifact/index.html")!;
  const result = verifyReceipt(receipt, artifact);
  console.log(printVerify(result));
  if (!result.ok) process.exitCode = 1;
}

function printVerify(v: ReturnType<typeof verifyReceipt>): string {
  const b = (ok: boolean) => (ok ? "PASS" : "FAIL");
  const lines = [
    `verification: ${v.ok ? "OK" : "FAILED"}`,
    `  signature      ${b(v.signatureValid)}`,
    `  artifact match ${b(v.artifactMatch)}`,
    `  machine checks ${b(v.checkMismatches.length === 0)}${v.checkMismatches.length ? " — " + v.checkMismatches.map((m) => m.name).join(", ") : ""}`,
    `  privacy clean  ${b(v.privacyClean)}`,
  ];
  return lines.join("\n");
}

const cmd = process.argv[2];
if (cmd === "build") cmdBuild();
else if (cmd === "verify") cmdVerify();
else {
  console.error("usage: tsx src/cli.ts <build|verify> [--fixture f] [--out d] [--receipt r] [--artifact a]");
  process.exitCode = 2;
}
