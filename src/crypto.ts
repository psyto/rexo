import {
  createHash,
  randomBytes,
  generateKeyPairSync,
  createPublicKey,
  createPrivateKey,
  sign as edSign,
  verify as edVerify,
} from "node:crypto";

export function sha256hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** 256-bit random salt (hex). Makes short-claim commitments unguessable. */
export function randomSalt(): string {
  return randomBytes(32).toString("hex");
}

/** A verifier keypair, serialized as base64 DER so it round-trips to disk/JSON. */
export interface KeyPair {
  publicKey: string; // base64 SPKI DER
  privateKey: string; // base64 PKCS8 DER
}

export function generateVerifierKey(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  };
}

/** Sign a message with an ed25519 private key (base64 PKCS8 DER). Returns base64. */
export function signMessage(message: string, privateKeyB64: string): string {
  const key = createPrivateKey({
    key: Buffer.from(privateKeyB64, "base64"),
    format: "der",
    type: "pkcs8",
  });
  return edSign(null, Buffer.from(message, "utf8"), key).toString("base64");
}

/** Verify an ed25519 signature. `publicKeyB64` = base64 SPKI DER, `sig` = base64. */
export function verifyMessage(message: string, sigB64: string, publicKeyB64: string): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    return edVerify(null, Buffer.from(message, "utf8"), key, Buffer.from(sigB64, "base64"));
  } catch {
    return false;
  }
}
