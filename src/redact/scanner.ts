// Secret / PII scanner. Runs on any string before it can leave the device.
// The point is defense-in-depth: even a maker-written "summary" is scanned, and
// the published Receipt is scanned again in the verifier as a final gate.

export interface SecretMatch {
  type: string;
  /** Start index in the scanned string. The matched text itself is never returned. */
  index: number;
  length: number;
}

interface Pattern {
  type: string;
  re: RegExp;
  /** Optional extra validation (e.g. Luhn) to cut false positives. */
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

export function scan(text: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      if (p.validate && !p.validate(m[0])) continue;
      matches.push({ type: p.type, index: m.index, length: m[0].length });
    }
  }
  return matches;
}

/** Replace every detected secret with a `[REDACTED:type]` marker. */
export function redactString(text: string): { redacted: string; types: string[] } {
  const found = scan(text).sort((a, b) => a.index - b.index);
  if (found.length === 0) return { redacted: text, types: [] };
  let out = "";
  let cursor = 0;
  const types: string[] = [];
  // Skip overlaps: keep the earliest match, advance past it.
  for (const f of found) {
    if (f.index < cursor) continue;
    out += text.slice(cursor, f.index) + `[REDACTED:${f.type}]`;
    cursor = f.index + f.length;
    types.push(f.type);
  }
  out += text.slice(cursor);
  return { redacted: out, types };
}
