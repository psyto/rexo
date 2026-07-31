import type { RawTrace, Receipt, Finding, MachineMetric } from "../types.js";
import type { VerificationResult } from "./verify.js";

// Two renderers with very different safety properties:
//
//  - renderPublishedReceipt: the ONLY output safe to share. Secret-free by
//    construction — renders solely from the (already-redacted) Receipt. Framed
//    as a CREDENTIAL (a verified track-record card), not a linter dump: the
//    machine metrics are shown as plain-language, independently-verified quality
//    signals, clearly separated from weak client-attested numbers.
//  - renderLocalComparison: the before/after view WITH the raw column. It
//    contains secrets and must only ever be written to a device-local, ignored
//    path — never published, shared, or committed.

const CSS = `
  :root { color-scheme: light dark; --bg:#f5f6f8; --fg:#1a1d21; --card:#fff; --line:#e4e7eb; --muted:#6b7280; --good:#0f8a4f; --good-bg:#e7f7ee; --weak:#8a6d00; --weak-bg:#fdf6e3; --bad:#b42318; --bad-bg:#fdecec; --accent:#3b5bdb; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0f1216; --fg:#e6e8eb; --card:#171b21; --line:#2a2f37; --muted:#9aa4b2; --good:#3ddc84; --good-bg:#123122; --weak:#e5c158; --weak-bg:#2c2712; --bad:#ff6b6b; --bad-bg:#331a1a; --accent:#8aa2ff; } }
  * { box-sizing: border-box; }
  body { font: 15px/1.55 system-ui, -apple-system, sans-serif; margin: 0; padding: 28px 20px; background: var(--bg); color: var(--fg); }
  .wrap { max-width: 780px; margin: 0 auto; }
  .cred { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
  .crown { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
  .seal { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; font-weight: 700; background: var(--good-bg); color: var(--good); border: 2px solid var(--good); }
  .seal.bad { background: var(--bad-bg); color: var(--bad); border-color: var(--bad); }
  .kicker { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
  h1 { font-size: 22px; margin: 2px 0 0; }
  .hero { color: var(--fg); margin: 14px 0 20px; font-size: 15px; }
  .hero b { color: var(--accent); }
  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 0 0 20px; }
  .fact { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
  .fact .k { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .fact .v { font-size: 16px; font-weight: 650; margin-top: 2px; }
  .fact .v.safe { color: var(--good); }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 22px 0 10px; display: flex; align-items: center; gap: 8px; }
  .pill { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; }
  .pill.strong { background: var(--good-bg); color: var(--good); }
  .pill.weak { background: var(--weak-bg); color: var(--weak); }
  .signals { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; }
  .sig { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; }
  .sig .label { font-size: 13px; }
  .sig .m { font-size: 11px; color: var(--muted); }
  .sig .value { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sig .value.yes { color: var(--good); }
  .sig .value.no { color: var(--bad); }
  .trace { margin: 6px 0 0; padding-left: 18px; font-size: 13px; color: var(--fg); }
  .trace li { margin: 2px 0; }
  .foot { margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
  .checks { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 0; }
  .chk { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: var(--good-bg); color: var(--good); }
  .chk.no { background: var(--bad-bg); color: var(--bad); }
  .mono { font-family: ui-monospace, monospace; font-size: 11px; word-break: break-all; }
  /* raw comparison (local only) */
  .warn { background: var(--bad-bg); border: 1px solid var(--bad); color: var(--bad); padding: 11px 14px; border-radius: 10px; margin: 0 auto 18px; max-width: 780px; font-weight: 600; }
  .raw { max-width: 780px; margin: 0 auto 16px; background: var(--card); border: 1px dashed var(--bad); border-radius: 12px; padding: 16px; }
  .raw h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: var(--bad); letter-spacing: .05em; }
  pre.secret { background: var(--bad-bg); border: 1px solid var(--bad); border-radius: 6px; padding: 8px; white-space: pre-wrap; word-break: break-word; margin: 6px 0; font-size: 12px; }
  .findings { max-width: 780px; margin: 14px auto 0; font-size: 13px; color: var(--muted); }
  code { background: var(--bg); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
`;

const LABELS: Record<string, string> = {
  has_title: "タイトル設定",
  has_viewport_meta: "レスポンシブ (viewport)",
  has_lang_attr: "言語属性 (a11y)",
  h1_count: "見出し H1",
  img_alt_coverage: "画像 alt 網羅率",
  relative_asset_refs: "相対アセット参照",
};

function fmtMetric(m: MachineMetric): { text: string; cls: string } {
  if (typeof m.value === "boolean") return { text: m.value ? "✓" : "✗", cls: m.value ? "yes" : "no" };
  if (m.unit === "ratio") return { text: `${Math.round(Number(m.value) * 100)}%`, cls: "" };
  return { text: `${m.value}${m.unit ? " " + m.unit : ""}`, cls: "" };
}

function credentialBody(receipt: Receipt, verify: VerificationResult): string {
  const cat = esc(receipt.conditions.category);
  const dom = receipt.conditions.domain ? ` / ${esc(receipt.conditions.domain)}` : "";

  const facts = [
    ["使用ツール", receipt.toolsUsed.map(esc).join(", ") || "—", ""],
    ["改訂回数", String(receipt.execution.revisions), ""],
    ["コスト帯", esc(receipt.execution.costBand), ""],
    ["所要時間帯", esc(receipt.execution.durationBand), ""],
    ["顧客データ露出", "なし", "safe"],
  ]
    .map(([k, v, cls]) => `<div class="fact"><div class="k">${esc(k!)}</div><div class="v ${cls}">${v}</div></div>`)
    .join("");

  const signals = receipt.metrics.machineRecomputed
    .map((m) => {
      const { text, cls } = fmtMetric(m);
      const label = LABELS[m.name] ?? esc(m.name);
      return `<div class="sig"><span><span class="label">${label}</span><br><span class="m">${esc(m.method)}</span></span><span class="value ${cls}">${text}</span></div>`;
    })
    .join("");

  const attested = receipt.metrics.clientAttested.length
    ? `<div class="signals">${receipt.metrics.clientAttested
        .map((m) => `<div class="sig"><span class="label">${esc(m.name)}</span><span class="value">${esc(String(m.value))}${m.unit ? " " + esc(m.unit) : ""}</span></div>`)
        .join("")}</div>`
    : `<p class="m" style="color:var(--muted)">（なし）</p>`;

  const trace = receipt.publishedTrace
    .map((e) => `<li>${esc(e.kind)}${e.tool ? ` · ${esc(e.tool)}` : ""} — ${esc(e.redactedSummary)}</li>`)
    .join("");

  const chk = (label: string, ok: boolean) => `<span class="chk ${ok ? "" : "no"}">${ok ? "✓" : "✗"} ${esc(label)}</span>`;
  const fp = receipt.issuedBy.verifierPublicKey.slice(0, 16);

  return `
    <div class="crown">
      <div class="seal ${verify.ok ? "" : "bad"}">${verify.ok ? "✓" : "!"}</div>
      <div>
        <div class="kicker">Verified Execution Credential</div>
        <h1>${cat}${dom}</h1>
      </div>
    </div>
    <p class="hero">AI 支援で <b>${cat}</b> を制作。独立検証者が成果物を<b>再計算チェック</b>済み。顧客データは受領内に留まり、この証明には含まれません。</p>

    <div class="facts">${facts}</div>

    <h2>独立に再計算された品質 <span class="pill strong">STRONG · 偽造不能</span></h2>
    <div class="signals">${signals}</div>

    <h2>顧客アテステーション <span class="pill weak">WEAK · 低信頼</span></h2>
    ${attested}

    <h2>実行トレース（要約）</h2>
    <ul class="trace">${trace}</ul>

    <div class="foot">
      <div class="checks">
        ${chk("署名", verify.signatureValid)}${chk("発行者", verify.issuerTrusted)}${chk("成果物一致", verify.artifactMatch)}${chk("再計算一致", verify.checkMismatches.length === 0)}${chk("正規形", verify.canonicalWire)}${chk("秘密ゼロ", verify.privacyClean)}
      </div>
      <p style="margin:10px 0 0">検証者公開鍵 <span class="mono">${esc(fp)}…</span> — 第三者は <code>receipt.json</code> と成果物とこの鍵で全項目を独立に再検証できます。</p>
    </div>`;
}

/** SAFE TO SHARE. Renders only from the redacted Receipt — carries no raw text. */
export function renderPublishedReceipt(receipt: Receipt, verify: VerificationResult): string {
  return page(
    `Verified Credential — ${esc(receipt.conditions.category)}`,
    `<div class="wrap"><div class="cred">${credentialBody(receipt, verify)}</div></div>`,
  );
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
    .map((e, i) => `<div class="ev"><b>#${i} ${esc(e.kind)}${e.tool ? " · " + esc(e.tool) : ""}</b>${e.rawText ? `<pre class="secret">${esc(e.rawText)}</pre>` : ""}</div>`)
    .join("");
  const rawInputs = (raw.inputs ?? [])
    .map((inp) => `<div class="ev"><b>input · ${esc(inp.kind)}</b>${inp.rawText ? `<pre class="secret">${esc(inp.rawText)}</pre>` : ""}</div>`)
    .join("");
  const findingRows = findings.length
    ? findings.map((f) => `<li><code>${esc(f.type)}</code> @ ${esc(f.location)}</li>`).join("")
    : `<li>検出なし</li>`;

  return page(
    `[LOCAL ONLY] ${esc(receipt.conditions.category)}`,
    `<div class="warn">⚠ このファイルは秘密（生プロンプト・顧客情報）を含みます。端末内でのみ閲覧し、共有・コミット・公開しないでください。</div>
     <div class="raw"><h3>RAW（端末内のみ・左が外に出ないことを確認する用）</h3>${rawEvents}${rawInputs}</div>
     <div class="wrap"><div class="cred">${credentialBody(receipt, verify)}</div></div>
     <div class="findings"><b>剥がした秘密（位置のみ・値は残さない）</b><ul>${findingRows}</ul></div>`,
  );
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>${CSS}</style></head>
<body>${body}</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
