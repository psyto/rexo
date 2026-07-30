import type { RawTrace, Receipt, Finding } from "../types.js";
import type { VerificationResult } from "./verify.js";

// Two renderers with very different safety properties:
//
//  - renderPublishedReceipt: the ONLY output safe to share. Secret-free by
//    construction — it renders solely from the (already-redacted) Receipt.
//  - renderLocalComparison: the before/after view WITH the raw column. It
//    contains secrets and must only ever be written to a device-local, ignored
//    path — never published, shared, or committed.

const CSS = `
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 system-ui, -apple-system, sans-serif; margin: 0; padding: 24px; background: #f6f7f9; color: #14171a; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #667; margin: 0 0 20px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
  .card { background: #fff; border: 1px solid #e3e6ea; border-radius: 12px; padding: 16px; }
  .card.raw { border-color: #f0c0c0; background: #fff8f8; }
  .card.pub { border-color: #bfe0c8; background: #f7fdf9; }
  .tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; margin-bottom: 10px; }
  .tag.raw { background: #fde2e2; color: #a11; }
  .tag.pub { background: #d8f3e0; color: #161; }
  .ev { border-bottom: 1px dashed #eee; padding: 6px 0; }
  .evk { font-weight: 600; font-size: 12px; color: #345; }
  pre.secret { background: #fff0f0; border: 1px solid #f3caca; border-radius: 6px; padding: 8px; white-space: pre-wrap; word-break: break-word; margin: 6px 0 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; }
  td { padding: 5px 6px; border-bottom: 1px solid #eef; vertical-align: top; }
  td.val { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
  td.method { color: #778; font-size: 12px; }
  .kv { font-size: 13px; }
  .kv b { display: inline-block; min-width: 92px; color: #556; font-weight: 600; }
  .mono { font-family: ui-monospace, monospace; font-size: 11px; word-break: break-all; color: #667; }
  .muted { color: #99a; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #667; margin: 16px 0 6px; }
  .badges { margin: 14px 0 20px; display: flex; gap: 8px; flex-wrap: wrap; }
  .badge { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
  .badge.ok { background: #d8f3e0; color: #161; }
  .badge.bad { background: #fde2e2; color: #a11; }
  .warn { background: #fff3cd; border: 1px solid #ffe08a; color: #7a5b00; padding: 10px 12px; border-radius: 8px; margin: 0 0 16px; font-size: 13px; font-weight: 600; }
  @media (max-width: 720px) { .cols { grid-template-columns: 1fr; } }
`;

function badges(verify: VerificationResult): string {
  const b = (label: string, ok: boolean) =>
    `<span class="badge ${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"} ${esc(label)}</span>`;
  return `<div class="badges">
    ${b("署名 valid", verify.signatureValid)}
    ${b("issuer trusted", verify.issuerTrusted)}
    ${b("artifact 独立再計算 一致", verify.artifactMatch)}
    ${b("machine checks 一致", verify.checkMismatches.length === 0)}
    ${b("秘密ゼロ (privacy clean)", verify.privacyClean)}
  </div>`;
}

function publishedCard(receipt: Receipt): string {
  const machine = receipt.metrics.machineRecomputed
    .map((m) => `<tr><td>${esc(m.name)}</td><td class="val">${esc(String(m.value))}${m.unit ? " " + esc(m.unit) : ""}</td><td class="method">${esc(m.method)}</td></tr>`)
    .join("");
  const attested = receipt.metrics.clientAttested.length
    ? receipt.metrics.clientAttested
        .map((m) => `<tr><td>${esc(m.name)}</td><td class="val">${esc(String(m.value))}${m.unit ? " " + esc(m.unit) : ""}</td><td class="method">client-attested · trust=${esc(m.trust)}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="muted">（なし）</td></tr>`;
  const pubTrace = receipt.publishedTrace
    .map((e) => `<li>${esc(e.kind)}${e.tool ? " · " + esc(e.tool) : ""} — ${esc(e.redactedSummary)}</li>`)
    .join("");
  return `<div class="card pub">
    <span class="tag pub">PUBLISHED RECEIPT · 秘密フリー</span>
    <div class="kv">
      <div><b>category</b> ${esc(receipt.conditions.category)}${receipt.conditions.domain ? " / " + esc(receipt.conditions.domain) : ""}</div>
      <div><b>input kinds</b> ${receipt.conditions.inputKinds.map(esc).join(", ") || "—"}</div>
      <div><b>tools</b> ${receipt.toolsUsed.map(esc).join(", ") || "—"}</div>
      <div><b>revisions</b> ${receipt.execution.revisions}</div>
      <div><b>cost / time</b> ${esc(receipt.execution.costBand)} · ${esc(receipt.execution.durationBand)}</div>
    </div>
    <h2>機械再計算メトリクス（強・偽造不能）</h2>
    <table>${machine}</table>
    <h2>顧客アテステーション（弱・低信頼）</h2>
    <table>${attested}</table>
    <h2>Published trace</h2>
    <ul>${pubTrace}</ul>
    <h2>Commitments</h2>
    <div class="kv">
      <div><b>artifact</b> <span class="mono">${esc(receipt.artifact.commitment)}</span></div>
      <div><b>salt commit</b> <span class="mono">${esc(receipt.saltCommitment)}</span></div>
      <div><b>verifier</b> <span class="mono">${esc(receipt.issuedBy.verifierPublicKey)}</span></div>
      <div><b>signature</b> <span class="mono">${esc(receipt.signature)}</span></div>
    </div>
  </div>`;
}

/** SAFE TO SHARE. Renders only from the redacted Receipt — carries no raw text. */
export function renderPublishedReceipt(receipt: Receipt, verify: VerificationResult): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Verified Receipt — ${esc(receipt.conditions.category)}</title>
<style>${CSS}</style></head>
<body>
  <h1>${esc(receipt.conditions.category)} — Verified Execution Receipt</h1>
  <p class="sub">公開される検証済み Receipt。顧客の秘密は含まれません（この文書は共有可能）。</p>
  ${badges(verify)}
  <div class="cols">${publishedCard(receipt)}</div>
</body></html>`;
}

/**
 * NOT SAFE TO SHARE. Includes the raw column with secrets for the maker's local
 * before/after review. Callers must write this only to a device-local, ignored
 * location (e.g. vault/).
 */
export function renderLocalComparison(args: {
  raw: RawTrace;
  receipt: Receipt;
  findings: Finding[];
  verify: VerificationResult;
}): string {
  const { raw, receipt, findings, verify } = args;
  const rawEvents = raw.events
    .map(
      (e, i) => `<div class="ev"><div class="evk">#${i} ${esc(e.kind)}${e.tool ? " · " + esc(e.tool) : ""}</div>${e.rawText ? `<pre class="secret">${esc(e.rawText)}</pre>` : ""}</div>`,
    )
    .join("");
  const rawInputs = (raw.inputs ?? [])
    .map((inp) => `<div class="ev"><div class="evk">input · ${esc(inp.kind)}</div>${inp.rawText ? `<pre class="secret">${esc(inp.rawText)}</pre>` : ""}</div>`)
    .join("");
  const findingRows = findings.length
    ? findings.map((f) => `<li><code>${esc(f.type)}</code> @ ${esc(f.location)}</li>`).join("")
    : `<li class="muted">検出なし</li>`;
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>[LOCAL ONLY] Receipt comparison — ${esc(receipt.conditions.category)}</title>
<style>${CSS}</style></head>
<body>
  <div class="warn">⚠ このファイルは秘密（生プロンプト・顧客情報）を含みます。端末内でのみ閲覧し、共有・コミット・公開しないでください。</div>
  <h1>${esc(receipt.conditions.category)} — RAW vs PUBLISHED（ローカル比較）</h1>
  ${badges(verify)}
  <div class="cols">
    <div class="card raw">
      <span class="tag raw">RAW · 端末内のみ・公開しない</span>
      <h2>Events</h2>${rawEvents || '<div class="muted">—</div>'}
      <h2>Inputs</h2>${rawInputs || '<div class="muted">—</div>'}
    </div>
    ${publishedCard(receipt)}
  </div>
  <h2>Redaction findings — 剥がした秘密（位置のみ・値は残さない）</h2>
  <ul>${findingRows}</ul>
</body></html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
