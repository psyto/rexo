// Post a real ERC-8004-style validationResponse to the deployed Solana Validation
// program on devnet. The response/tag/responseHash are DERIVED from re-running a
// bundle's committed + independent held-out suites (see scripts/tier.mjs), so the
// held-out correctness TIER is carried on-chain, not just a pass/fail:
//   held-out-verified → response 100, tag "held-out-verified"
//   committed-only    → response  70, tag "committed-only"
//   held-out-FAILED   → response   0, tag "held-out-FAILED"
// responseHash is a reproducible commitment to the exact re-execution facts.
//
// Env: RPC, PROGRAM_ID, KEYPAIR (funded devnet keypair json), FIXTURE (bundle dir,
//      default ../fixtures/reckn-r1-heldout), AGENT_ID (default 42).
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveTier, tagBytes32 } from "./tier.mjs";

const RPC = process.env.RPC;
const PROGRAM = new PublicKey(process.env.PROGRAM_ID);
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.KEYPAIR, "utf8"))));
const conn = new Connection(RPC, "confirmed");

// Derive the on-chain fields from a real held-out re-execution.
const t = await deriveTier(resolve(process.env.FIXTURE || "../fixtures/reckn-r1-heldout"));
console.log(`tier: ${t.tier}  committed ${t.committed}  held-out ${t.heldout}  → response ${t.response}`);
console.log(`responseHash (reproducible): ${t.responseHash}`);

const RECORD_LEN = 113;
const record = Keypair.generate();
const rent = await conn.getMinimumBalanceForRentExemption(RECORD_LEN);

const responseHash = Buffer.from(t.responseHash, "hex");
const agentId = Buffer.alloc(8); agentId.writeBigUInt64LE(BigInt(process.env.AGENT_ID || "42"));
const tag = tagBytes32(t.tag); // 32 bytes, right-padded
const data = Buffer.concat([Buffer.from([0]), agentId, Buffer.from([t.response]), responseHash, tag]);

const createIx = SystemProgram.createAccount({
  fromPubkey: payer.publicKey, newAccountPubkey: record.publicKey,
  lamports: rent, space: RECORD_LEN, programId: PROGRAM,
});
const recordIx = new TransactionInstruction({
  programId: PROGRAM,
  keys: [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // validator
    { pubkey: record.publicKey, isSigner: false, isWritable: true }, // record
  ],
  data,
});

const sig = await sendAndConfirmTransaction(conn, new Transaction().add(createIx, recordIx), [payer, record]);
console.log("validationResponse tx :", sig);
console.log("record account        :", record.publicKey.toBase58());
console.log("explorer tx           : https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
console.log("explorer record       : https://explorer.solana.com/address/" + record.publicKey.toBase58() + "?cluster=devnet");
