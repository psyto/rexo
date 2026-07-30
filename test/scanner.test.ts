import { describe, it, expect } from "vitest";
import { scan, redactString } from "../src/redact/scanner.js";

const SAMPLES: Array<[string, string]> = [
  ["openai_key", "sk-proj-ABCD1234abcd5678EFGH9012ijkl"],
  ["anthropic_key", "sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUV"],
  ["aws_access_key", "AKIAABCDEFGHIJKLMNOP"],
  ["google_api_key", "AIzaSyA1234567890abcdefghijklmnopqrstuv"],
  ["github_token", "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"],
  ["slack_token", "xoxb-1234567890-abcdefghij"],
  ["jwt", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123_-"],
  ["private_key_pem", "-----BEGIN OPENSSH PRIVATE KEY-----"],
  ["hex_private_key", "0x" + "a".repeat(64)],
  ["email", "owner@sakura-diner.example"],
  ["intl_phone", "+81 3-1234-5678"],
  ["jp_phone", "03-1234-5678"],
  ["credit_card", "4111 1111 1111 1111"],
];

describe("scanner", () => {
  it("detects at least 13 kinds of secret/PII (>=10 required)", () => {
    const kinds = new Set(SAMPLES.map(([k]) => k));
    expect(kinds.size).toBeGreaterThanOrEqual(10);
  });

  for (const [kind, sample] of SAMPLES) {
    it(`detects ${kind}`, () => {
      const found = scan(`前置き ${sample} 後置き`);
      expect(found.some((f) => f.type === kind)).toBe(true);
    });
  }

  it("rejects a non-Luhn 16-digit number as a credit card", () => {
    const found = scan("order id 4111111111111112 done");
    expect(found.some((f) => f.type === "credit_card")).toBe(false);
  });

  it("returns nothing for clean marketing copy", () => {
    expect(scan("昼は定食、夜は一品とお酒。駅前徒歩3分。")).toHaveLength(0);
  });

  it("catches full-width email after NFKC normalization", () => {
    const found = scan("連絡先 ｏｗｎｅｒ＠ｅｘａｍｐｌｅ．ｃｏｍ まで");
    expect(found.some((f) => f.type === "email")).toBe(true);
  });

  it("catches full-width phone after NFKC normalization", () => {
    const found = scan("電話 ０３－１２３４－５６７８");
    expect(found.some((f) => f.type === "jp_phone")).toBe(true);
  });

  it("catches a zero-width-split email", () => {
    const found = scan("mail ow" + "\u200B" + "ner@example.com now");
    expect(found.some((f) => f.type === "email")).toBe(true);
  });

  it("redactString replaces the secret and never leaves it behind", () => {
    const { redacted, types } = redactString("mail owner@sakura-diner.example now");
    expect(redacted).toContain("[REDACTED:email]");
    expect(redacted).not.toContain("owner@sakura-diner.example");
    expect(types).toContain("email");
  });
});
