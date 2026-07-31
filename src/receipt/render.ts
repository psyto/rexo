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
  /* profile / résumé (LinkedIn-style) */
  .lp { background: var(--card); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
  .banner { height: 84px; background: linear-gradient(120deg, var(--accent), #6d3bdb); }
  .lp .pad { padding: 0 24px 22px; }
  .avatar { width: 88px; height: 88px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 32px; font-weight: 700; border: 4px solid var(--card); margin-top: -44px; }
  .name { font-size: 24px; font-weight: 700; margin: 10px 0 2px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .verbadge { font-size: 12px; font-weight: 700; color: var(--good); background: var(--good-bg); border-radius: 999px; padding: 3px 10px; }
  .headline2 { font-size: 15px; }
  .metaline { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .skills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .skill { font-size: 12px; background: var(--bg); border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; }
  .hi { display: flex; gap: 22px; margin-top: 16px; flex-wrap: wrap; }
  .hi .h { font-size: 21px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .hi .h.good { color: var(--good); }
  .hi .l { font-size: 12px; color: var(--muted); }
  .sec { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px 24px; }
  .sec > h2 { margin: 0 0 2px; font-size: 18px; text-transform: none; letter-spacing: 0; color: var(--fg); }
  .xp { display: grid; grid-template-columns: 48px 1fr; gap: 14px; padding: 18px 0; border-top: 1px solid var(--line); }
  .xp.first { border-top: 0; padding-top: 8px; }
  .xpicon { width: 48px; height: 48px; border-radius: 10px; background: var(--bg); border: 1px solid var(--line); display: grid; place-items: center; font-size: 24px; }
  .xptop { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .xptitle { font-weight: 700; font-size: 16px; }
  .xpdate { color: var(--muted); font-size: 12px; white-space: nowrap; }
  .xpsub { color: var(--muted); font-size: 13px; margin: 1px 0 4px; }
  .xpbul { margin: 6px 0 0; padding-left: 18px; font-size: 13.5px; }
  .xpbul li { margin: 3px 0; }
  .xpbul b { font-variant-numeric: tabular-nums; }
  .xpver { font-size: 12px; font-weight: 600; color: var(--good); margin-top: 8px; }
  .xpver.no { color: var(--bad); }
`;

const LABELS: Record<string, string> = {
  // web
  has_title: "タイトル設定",
  has_viewport_meta: "レスポンシブ (viewport)",
  has_lang_attr: "言語属性 (a11y)",
  h1_count: "見出し H1",
  img_alt_coverage: "画像 alt 網羅率",
  relative_asset_refs: "相対アセット参照",
  // swe
  target_test_passes: "対象テスト通過",
  tests_passed: "通過テスト",
  tests_failed: "失敗テスト",
  pass_rate: "通過率",
  regressions: "回帰",
};

function fmtMetric(m: MachineMetric): { text: string; cls: string } {
  if (typeof m.value === "boolean") return { text: m.value ? "✓" : "✗", cls: m.value ? "yes" : "no" };
  if (m.unit === "ratio") return { text: `${Math.round(Number(m.value) * 100)}%`, cls: "" };
  return { text: `${m.value}${m.unit ? " " + m.unit : ""}`, cls: "" };
}

function credentialBody(receipt: Receipt, verify: VerificationResult): string {
  const facts = [
    ["モデル/ツール", receipt.toolsUsed.map(esc).join(", ") || "—", ""],
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
  const afp = receipt.subject.agentKey.slice(0, 16);

  return `
    <div class="crown">
      <div class="seal ${verify.ok ? "" : "bad"}">${verify.ok ? "✓" : "!"}</div>
      <div>
        <div class="kicker">Verified Execution Credential · agent @${esc(receipt.subject.agentId)}${receipt.subject.operator ? ` · op @${esc(receipt.subject.operator)}` : ""}</div>
        <h1>${esc(receipt.title ?? receipt.conditions.category)}</h1>
      </div>
    </div>
    <p class="hero">エージェント <b>@${esc(receipt.subject.agentId)}</b> が <b>${esc(receipt.title ?? receipt.conditions.category)}</b> を遂行。独立検証者が成果物を<b>再計算チェック</b>済み。顧客データは受領内に留まり、この証明には含まれません。</p>

    <div class="facts">${facts}</div>

    <h2>独立に再計算された品質 <span class="pill strong">STRONG · 偽造不能</span></h2>
    <div class="signals">${signals}</div>

    <h2>顧客アテステーション <span class="pill weak">WEAK · 低信頼</span></h2>
    ${attested}

    <h2>実行トレース（要約）</h2>
    <ul class="trace">${trace}</ul>

    <div class="foot">
      <div class="checks">
        ${chk("検証者署名", verify.signatureValid)}${chk("発行者", verify.issuerTrusted)}${chk("本人署名", verify.agentSignatureValid)}${chk("成果物一致", verify.artifactMatch)}${chk("再計算一致", verify.checkMismatches.length === 0)}${chk("正規形", verify.canonicalWire)}${chk("秘密ゼロ", verify.privacyClean)}
      </div>
      <p style="margin:10px 0 0">エージェント鍵 <span class="mono">${esc(afp)}…</span>（本人署名）· 検証者鍵 <span class="mono">${esc(fp)}…</span> — 第三者は <code>receipt.json</code> と成果物と両鍵で全項目を独立に再検証できます。</p>
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

export interface ProfileEntry {
  receipt: Receipt;
  verify: VerificationResult;
}

/**
 * SAFE TO SHARE. A maker's verified track record: many credentials aggregated
 * under one identity with roll-up stats — this is what reads as a résumé (職歴),
 * versus a single-job certificate. Renders only from redacted receipts.
 */
export function renderProfile(entries: ProfileEntry[]): string {
  const subj = entries[0]?.receipt.subject;
  const agentId = subj?.agentId ?? "unknown";
  const operator = subj?.operator;
  const agentKey = subj?.agentKey ?? "";
  const agentFp = agentKey.slice(0, 16);
  // Identity is the KEY: every entry must be signed by, and name, the same key.
  const oneKey = agentKey !== "" && entries.every((e) => e.receipt.subject.agentKey === agentKey);
  const authored = entries.filter((e) => e.verify.agentSignatureValid).length;
  const n = entries.length;
  const verified = entries.filter((e) => e.verify.ok).length;
  const swe = entries.filter((e) => e.receipt.artifact.kind === "swe");
  const fixes = swe.filter((e) => metricVal(e.receipt, "target_test_passes") === true).length;
  const regressions = swe.reduce((s, e) => s + Number(metricVal(e.receipt, "regressions") ?? 0), 0);
  const facts = entries.reduce((s, e) => s + e.receipt.metrics.machineRecomputed.length, 0);
  const skills = [...new Set(entries.flatMap((e) => e.receipt.toolsUsed))];
  const domains = [...new Set(entries.map((e) => e.receipt.conditions.domain).filter(Boolean) as string[])];

  // reverse-chronological, like a résumé
  const sorted = [...entries].sort((a, b) =>
    (b.receipt.completedAt ?? "").localeCompare(a.receipt.completedAt ?? ""),
  );

  const mono = (agentId.slice(0, 2) || "?").toUpperCase();
  const hi = (num: string, l: string, good = false) =>
    `<div><div class="h ${good ? "good" : ""}">${esc(num)}</div><div class="l">${esc(l)}</div></div>`;

  const xps = sorted
    .map((e, i) => {
      const r = e.receipt;
      const ok = e.verify.ok;
      const title = r.title ?? humanizeCat(r.conditions.category);
      const date = r.completedAt ? fmtMonth(r.completedAt) : "";
      const sub = `${kindLabel(r.artifact.kind)}${r.conditions.domain ? " · " + esc(r.conditions.domain) : ""} · 改訂 ${r.execution.revisions} · ${esc(r.execution.costBand)} / ${esc(r.execution.durationBand)}`;
      const bullets = bulletsFor(r).map((b) => `<li>${b}</li>`).join("");
      return `<div class="xp${i === 0 ? " first" : ""}">
        <div class="xpicon">${iconFor(r)}</div>
        <div>
          <div class="xptop"><div class="xptitle">${esc(title)}</div><div class="xpdate">${esc(date)}</div></div>
          <div class="xpsub">${sub}</div>
          <ul class="xpbul">${bullets}</ul>
          <div class="xpver ${ok ? "" : "no"}">${ok ? "✓ 独立に検証済み（検証者署名・本人署名・成果物の再計算一致・正規形・秘密ゼロ）" : "✗ 未検証"}</div>
        </div>
      </div>`;
    })
    .join("");

  const body = `<div class="wrap">
    <div class="lp">
      <div class="banner"></div>
      <div class="pad">
        <div class="avatar">${esc(mono)}</div>
        <div class="name">Agent @${esc(agentId)} <span class="verbadge">✓ Verified</span>${oneKey ? ` <span class="verbadge">🔑 Key-bound</span>` : ""}</div>
        <div class="headline2">自律 AI エージェント — 検証済み実行実績（職歴）</div>
        <div class="metaline">${operator ? `operated by @${esc(operator)} · ` : ""}独立検証者が各成果物を再実行チェック · 顧客データ / 専有ソース非公開${domains.length ? " · " + domains.map(esc).join(" / ") : ""}</div>
        <div class="metaline">identity（鍵束縛）: <span class="mono">${esc(agentFp)}…</span> · ${authored}/${n} 件をこの鍵が署名（本人証明・なりすまし不可）</div>
        <div class="hi">
          ${hi(String(n), "検証済み実績")}
          ${hi(`${verified}/${n}`, "独立検証", verified === n)}
          ${hi(String(fixes), "証明された修正")}
          ${hi(String(regressions), "回帰合計", regressions === 0)}
          ${hi(String(facts), "再計算した事実")}
        </div>
        ${skills.length ? `<div class="skills">${skills.map((s) => `<span class="skill">${esc(s)}</span>`).join("")}</div>` : ""}
      </div>
    </div>
    <div class="sec">
      <h2>Experience</h2>
      <p class="metaline" style="margin:0 0 6px">各項目は receipt.json と成果物で第三者が独立に再検証できます。</p>
      ${xps}
    </div>
  </div>`;
  return page(`Agent @${esc(agentId)} — Verified Track Record`, body);
}

const CATEGORY_JA: Record<string, string> = {
  "evm-reexec-bugfix": "EVM 再実行のバグ修正",
  "smart-contract-remediation": "スマートコントラクト脆弱性の修正",
  "bugfix-typescript": "TypeScript バグ修正",
  "restaurant-lp": "飲食店 LP 制作",
};
function humanizeCat(c: string): string {
  return CATEGORY_JA[c] ?? c.replace(/-/g, " ");
}
function kindLabel(k: string): string {
  return k === "swe" ? "ソフトウェア修正（独立再実行）" : "Web 制作（独立再計算）";
}
function iconFor(r: Receipt): string {
  const d = r.conditions.domain;
  if (d === "evm") return "⛓️";
  if (d === "defi") return "🛡️";
  if (d === "web") return "🌐";
  if (d === "backend") return "🔧";
  return "✅";
}
function fmtMonth(d: string): string {
  const [y, m] = d.split("-");
  return m ? `${y}年${Number(m)}月` : (y ?? d);
}
function bulletsFor(r: Receipt): string[] {
  const b: string[] = [];
  if (r.artifact.kind === "swe") {
    const tp = Number(metricVal(r, "tests_passed") ?? 0);
    const tf = Number(metricVal(r, "tests_failed") ?? 0);
    if (metricVal(r, "target_test_passes") === true) b.push("対象の回帰テストが<b>独立再実行で通過</b>（改ざん不能）");
    b.push(`テスト <b>${tp}/${tp + tf}</b> 通過・回帰 <b>${esc(String(metricVal(r, "regressions") ?? 0))}</b>`);
    b.push("顧客データ・専有ソースは非公開（bundle ハッシュのみ公開）");
  } else {
    b.push(`成果物の品質指標 <b>${r.metrics.machineRecomputed.length}</b> 項目を<b>独立再計算</b>`);
    b.push("顧客データは非公開");
  }
  const t = r.toolsUsed.slice(0, 4).map(esc).join(", ");
  if (t) b.push(`使用ツール: ${t}`);
  return b;
}

function metricVal(r: Receipt, name: string): number | string | boolean | undefined {
  return r.metrics.machineRecomputed.find((m) => m.name === name)?.value;
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
