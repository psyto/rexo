// Read a Rexo validation record back from Solana devnet — no keypair, no funds.
// Proves the held-out tier is really on-chain, not just claimed in a table.
//
//   node scripts/read-record.mjs <record-pubkey>
//   RPC=<devnet rpc> node scripts/read-record.mjs <record-pubkey>   # custom RPC
//
// Record layout (113 bytes, write-once, validator-signed):
//   [validator:32][agent_id:8 LE][response:1][response_hash:32][tag:32][slot:8 LE]
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const NUL = String.fromCharCode(0);
const rec = process.argv[2] || "Ebqsseoy4oCx2DQopDujsjWREHXc6wjUhUPDApiJ8rsp";
const rpc = process.env.RPC || clusterApiUrl("devnet");
const conn = new Connection(rpc, "confirmed");

const ai = await conn.getAccountInfo(new PublicKey(rec));
if (!ai) { console.error(`no account at ${rec} on ${rpc}`); process.exit(1); }
const d = ai.data;
if (d.length !== 113) console.error(`warning: expected 113 bytes, got ${d.length}`);

const out = {
  record: rec,
  owner: ai.owner.toBase58(),
  validator: new PublicKey(d.subarray(0, 32)).toBase58(),
  agent_id: d.readBigUInt64LE(32).toString(),
  response: d[40],
  response_hash: Buffer.from(d.subarray(41, 73)).toString("hex"),
  tag: Buffer.from(d.subarray(73, 105)).toString("utf8").split(NUL)[0],
  slot: d.readBigUInt64LE(105).toString(),
};
console.log(JSON.stringify(out, null, 2));
