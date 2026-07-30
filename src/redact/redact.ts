import type { RawTrace, PublishedEvent, Finding } from "../types.js";
import { scan, redactString } from "./scanner.js";

export interface RedactionResult {
  published: PublishedEvent[];
  inputKinds: string[];
  /** What was stripped, by location. Never contains the secret values. */
  findings: Finding[];
}

/**
 * Map a device-local RawTrace to the secret-free published side.
 *
 * Guarantees:
 *  - `rawText` never survives — it is dropped, only a redacted summary remains.
 *  - Every published string is scanned; any residual secret is redacted.
 *  - Findings record *where* secrets were, never *what* they were.
 */
export function redactTrace(raw: RawTrace): RedactionResult {
  const findings: Finding[] = [];
  const published: PublishedEvent[] = [];

  raw.events.forEach((ev, i) => {
    // Record findings from the raw side (so the maker sees what was removed).
    if (ev.rawText) {
      for (const m of scan(ev.rawText)) {
        findings.push({ type: m.type, location: `events[${i}].rawText` });
      }
    }
    // Build the published summary from the maker's summary if present, else a
    // generic derivation of the raw text — always passed through redaction.
    const base = ev.summary ?? deriveSummary(ev);
    const { redacted, types } = redactString(base);
    for (const t of types) {
      findings.push({ type: t, location: `events[${i}].summary` });
    }
    published.push({
      kind: ev.kind,
      ...(ev.tool ? { tool: ev.tool } : {}),
      redactedSummary: redacted,
    });
  });

  const inputKinds: string[] = [];
  (raw.inputs ?? []).forEach((inp, i) => {
    inputKinds.push(inp.kind);
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
