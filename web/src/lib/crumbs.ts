import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  COOKIE_JAR,
  CRUMB_PREFIX,
  DEFAULT_TIP_LAMPORTS,
  MEMO_PROGRAM_ID,
} from "./cookie";

export function buildCrumbTransaction(params: {
  payer: PublicKey;
  message: string;
  tipLamports?: number;
}): Transaction {
  const tip = params.tipLamports ?? DEFAULT_TIP_LAMPORTS;
  const memoText = `${CRUMB_PREFIX}${params.message}`.slice(0, 566);
  const tx = new Transaction();

  tx.add(
    new TransactionInstruction({
      keys: [{ pubkey: params.payer, isSigner: true, isWritable: true }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoText, "utf8"),
    }),
  );

  if (tip > 0) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: params.payer,
        toPubkey: COOKIE_JAR,
        lamports: tip,
      }),
    );
  }

  return tx;
}

export type CrumbActivity = {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
  memo: string | null;
};

export async function fetchJarActivity(
  connection: Connection,
  limit = 12,
): Promise<CrumbActivity[]> {
  const sigs = await connection.getSignaturesForAddress(COOKIE_JAR, { limit });
  const out: CrumbActivity[] = [];

  for (const s of sigs) {
    let memo: string | null = null;
    try {
      const parsed = await connection.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      });
      const instructions =
        parsed?.transaction.message.instructions ?? [];
      for (const ix of instructions) {
        if ("parsed" in ix && ix.program === "spl-memo") {
          memo = String(ix.parsed);
        } else if ("programId" in ix) {
          const pid = ix.programId.toBase58?.() ?? String(ix.programId);
          if (pid === MEMO_PROGRAM_ID.toBase58() && "data" in ix) {
            try {
              memo = Buffer.from(String(ix.data), "base64").toString("utf8");
            } catch {
              /* ignore */
            }
          }
        }
      }
      // also scan log messages
      if (!memo && parsed?.meta?.logMessages) {
        for (const line of parsed.meta.logMessages) {
          const m = line.match(/Program log: Memo \(len \d+\): "(.+)"/);
          if (m) memo = m[1];
        }
      }
    } catch {
      /* skip parse errors */
    }

    out.push({
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime ?? null,
      err: s.err,
      memo,
    });
  }

  return out;
}

export async function fetchUserSignatures(
  connection: Connection,
  owner: PublicKey,
  limit = 8,
) {
  return connection.getSignaturesForAddress(owner, { limit });
}
