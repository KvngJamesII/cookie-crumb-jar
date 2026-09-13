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
  tipLamports: number | null;
  isCrumb: boolean;
  feePayer: string | null;
};

function extractMemo(parsed: Awaited<ReturnType<Connection["getParsedTransaction"]>>): string | null {
  if (!parsed) return null;
  const instructions = parsed.transaction.message.instructions ?? [];
  for (const ix of instructions) {
    if ("parsed" in ix && (ix as { program?: string }).program === "spl-memo") {
      const p = (ix as { parsed: unknown }).parsed;
      return typeof p === "string" ? p : JSON.stringify(p);
    }
    if ("programId" in ix) {
      const pid =
        typeof ix.programId === "object" && ix.programId && "toBase58" in ix.programId
          ? (ix.programId as PublicKey).toBase58()
          : String(ix.programId);
      if (pid === MEMO_PROGRAM_ID.toBase58() && "data" in ix) {
        try {
          return Buffer.from(String((ix as { data: string }).data), "base64").toString("utf8");
        } catch {
          /* ignore */
        }
      }
    }
  }
  if (parsed.meta?.logMessages) {
    for (const line of parsed.meta.logMessages) {
      const m = line.match(/Program log: Memo \(len \d+\): "(.+)"/);
      if (m) return m[1];
    }
  }
  return null;
}

function extractTip(parsed: Awaited<ReturnType<Connection["getParsedTransaction"]>>): number | null {
  if (!parsed?.meta) return null;
  const jar = COOKIE_JAR.toBase58();
  const keys = parsed.transaction.message.accountKeys.map((k) =>
    typeof k === "string" ? k : k.pubkey.toBase58(),
  );
  const idx = keys.indexOf(jar);
  if (idx < 0) return null;
  const pre = parsed.meta.preBalances[idx];
  const post = parsed.meta.postBalances[idx];
  if (pre == null || post == null) return null;
  const delta = post - pre;
  return delta > 0 ? delta : null;
}

export async function fetchJarActivity(
  connection: Connection,
  limit = 16,
): Promise<CrumbActivity[]> {
  const sigs = await connection.getSignaturesForAddress(COOKIE_JAR, { limit });
  const parsedList = await Promise.all(
    sigs.map((s) =>
      connection
        .getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 })
        .catch(() => null),
    ),
  );

  return sigs.map((s, i) => {
    const parsed = parsedList[i];
    const memo = extractMemo(parsed);
    const tipLamports = extractTip(parsed);
    const feePayer = parsed?.transaction.message.accountKeys[0]
      ? typeof parsed.transaction.message.accountKeys[0] === "string"
        ? parsed.transaction.message.accountKeys[0]
        : parsed.transaction.message.accountKeys[0].pubkey.toBase58()
      : null;
    return {
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime ?? null,
      err: s.err,
      memo,
      tipLamports,
      isCrumb: Boolean(memo?.startsWith(CRUMB_PREFIX)),
      feePayer,
    };
  });
}

export async function fetchUserSignatures(
  connection: Connection,
  owner: PublicKey,
  limit = 8,
) {
  return connection.getSignaturesForAddress(owner, { limit });
}

export function displayMemo(memo: string | null): string {
  if (!memo) return "";
  if (memo.startsWith(CRUMB_PREFIX)) return memo.slice(CRUMB_PREFIX.length);
  return memo;
}

export function formatTime(blockTime: number | null): string {
  if (!blockTime) return "—";
  return new Date(blockTime * 1000).toLocaleString();
}
