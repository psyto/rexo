import type { RawTrace, PublishedEvent, Finding } from "../types.js";
import { scan, redactString } from "./scanner.js";
import { assertKind, label } from "../publish-guard.js";

export interface RedactionResult {
  published: PublishedEvent[];
  inputKinds: string[];
  /** What was stripped, by location. Never contains the secret values. */
  findings: Finding[];
}

/**
 * Map a device-local RawTrace to the secret-free published side.
 *
 * Guarantees (for this stage — the builder adds a fail-closed final scan):
 *  - `rawText` never survives — it is dropped, only a redacted summary remains.
 *  - Every published string is normalized + scanned; residual secrets redacted.
 *  - Findings record *where* secrets were, never *what* they were.
 */
export function redactTrace(raw: RawTrace): RedactionResult {
  const findings: Finding[] = [];
  const published: PublishedEvent[] = [];

  raw.events.forEach((ev, i) => {
    assertKind(ev.kind, `events[${i}]`); // reject arbitrary strings in a structural field
    if (ev.rawText) {
      for (const m of scan(ev.rawText)) {
        findings.push({ type: m.type, location: `events[${i}].rawText` });
      }
    }
    const base = ev.summary ?? deriveSummary(ev);
    const { redacted, types } = redactString(base);
    for (const t of types) findings.push({ type: t, location: `events[${i}].summary` });
    published.push({
      kind: ev.kind,
      ...(ev.tool ? { tool: label(ev.tool, `events[${i}].tool`) } : {}),
      redactedSummary: redacted,
    });
  });

  const inputKinds: string[] = [];
  (raw.inputs ?? []).forEach((inp, i) => {
    inputKinds.push(label(inp.kind, `inputs[${i}].kind`));
    if (inp.rawText) {
      for (const m of scan(inp.rawText)) {
        findings.push({ type: m.type, location: `inputs[${i}].rawText` });
      }
    }
  });

  return { published, inputKinds: dedupe(inputKinds), findings };
}

function deriveSummary(ev: { kind: string; tool?: string }): string {
  return ev.tool ? `${ev.kind} via ${ev.tool}` : ev.kind;
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}
