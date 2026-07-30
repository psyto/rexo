// Secret / PII scanner. Runs on any string before it can leave the device.
//
// This is DEFENSE-IN-DEPTH, not the primary guarantee. It has known false
// negatives (Base64/high-entropy secrets, names, postal addresses, contacts
// split across newlines). The primary guarantees are elsewhere: the published
// receipt carries no free-form raw text, and the builder fails closed if any
// residual secret is detected before writing. Never rely on the scanner alone
// to make arbitrary free text safe to publish.

export interface SecretMatch {
  type: string;
  index: number;
  length: number;
}

interface Pattern {
  type: string;
  re: RegExp;
  validate?: (m: string) => boolean;
}

const PATTERNS: Pattern[] = [
  { type: "openai_key", re: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { type: "anthropic_key", re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { type: "aws_access_key", re: /AKIA[0-9A-Z]{16}/g },
  { type: "google_api_key", re: /AIza[0-9A-Za-z_-]{35}/g },
  { type: "github_token", re: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { type: "slack_token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { type: "jwt", re: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { type: "private_key_pem", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { type: "hex_private_key", re: /\b0x[0-9a-fA-F]{64}\b/g },
  { type: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: "intl_phone", re: /\+\d[\d ().-]{7,}\d/g },
  { type: "jp_phone", re: /\b0\d{1,3}-\d{2,4}-\d{3,4}\b/g },
  {
    type: "credit_card",
    re: /\b(?:\d[ -]?){13,19}\b/g,
    validate: (m) => luhn(m.replace(/[ -]/g, "")),
  },
];

function luhn(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/**
 * NFKC-normalize and strip zero-width / invisible characters so that full-width
 * (ｏｗｎｅｒ＠…, ０３－…) and zero-width-obfuscated secrets collapse to their
 * ASCII form before pattern matching. Scanning and redaction both run on this
 * normalized form.
 */
export function normalizeForScan(text: string): string {
  return text.normalize("NFKC").replace(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g, "");
}

export function scan(text: string): SecretMatch[] {
  const normalized = normalizeForScan(text);
  const matches: SecretMatch[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(normalized)) !== null) {
      if (p.validate && !p.validate(m[0])) continue;
      matches.push({ type: p.type, index: m.index, length: m[0].length });
    }
  }
  return matches;
}

/** Replace every detected secret with a `[REDACTED:type]` marker (on normalized text). */
export function redactString(text: string): { redacted: string; types: string[] } {
  const normalized = normalizeForScan(text);
  const found = scan(normalized).sort((a, b) => a.index - b.index);
  if (found.length === 0) return { redacted: normalized, types: [] };
  let out = "";
  let cursor = 0;
  const types: string[] = [];
  for (const f of found) {
    if (f.index < cursor) continue; // skip overlaps
    out += normalized.slice(cursor, f.index) + `[REDACTED:${f.type}]`;
    cursor = f.index + f.length;
    types.push(f.type);
  }
  out += normalized.slice(cursor);
  return { redacted: out, types };
}
