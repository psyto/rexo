// Post a real ERC-8004-style validationResponse to the deployed Solana Validation
// program on devnet: create a program-owned record account + record the
// re-execution result (response=100, responseHash = a Context Capital re-exec
// commitment). Prints the tx signature (the on-chain evidence).
//
// Env: RPC, PROGRAM_ID, KEYPAIR (path to a funded devnet keypair json).
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";

const RPC = process.env.RPC;
const PROGRAM = new PublicKey(process.env.PROGRAM_ID);
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.KEYPAIR, "utf8"))));
const conn = new Connection(RPC, "confirmed");

const RECORD_LEN = 113;
const record = Keypair.generate();
const rent = await conn.getMinimumBalanceForRentExemption(RECORD_LEN);

// A real Context Capital re-execution commitment (the reckn-R1 verified receipt).
const responseHash = Buffer.from("b61a40402fa247ff4b8890c9a8c0fff19afffe0e6f5380baa822d63a9ef753a9", "hex");
const agentId = Buffer.alloc(8); agentId.writeBigUInt64LE(42n);
const tag = Buffer.from("reexec--------------------------", "utf8"); // 32 bytes
const data = Buffer.concat([Buffer.from([0]), agentId, Buffer.from([100]), responseHash, tag]);

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
