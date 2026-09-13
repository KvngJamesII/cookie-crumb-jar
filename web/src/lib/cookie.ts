import { PublicKey } from "@solana/web3.js";

/** Cookie Chain public endpoints & genesis programs (from @cookiechain/skill reference). */
export const COOKIE_RPC = "https://rpc.cookiescan.io";
export const COOKIE_WSS = "wss://wss.cookiescan.io";
export const COOKIE_EXPLORER = "https://cookiescan.io";
export const COOKIE_BRIDGE = "https://bridge.cookiescan.io";
export const COOKIE_DOCS = "https://docs.cookiechain.wtf";
export const COOKIE_DAS = "https://api.cookiescan.io";
export const COOKIE_ONBOARD = "https://onboard.cookiechain.wtf";

/** Cookie Chain Memo v1 (differs from Solana mainnet Memo ID). */
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

/** Official Cookie Jar (Vault 1) — builder fund. */
export const COOKIE_JAR = new PublicKey(
  "568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe",
);

/** Tiny tip with each crumb (0.00001 COOK). Users can set tip to 0 for memo-only. */
export const DEFAULT_TIP_LAMPORTS = 10_000;

export const CRUMB_PREFIX = "cookie-crumb:";

export function explorerTx(sig: string) {
  return `${COOKIE_EXPLORER}/tx/${sig}`;
}

export function explorerAddress(addr: string) {
  return `${COOKIE_EXPLORER}/address/${addr}`;
}

export function formatCook(lamports: number | bigint, digits = 6): string {
  const n = Number(lamports) / 1e9;
  return `${n.toFixed(digits)} COOK`;
}

export function shortAddr(addr: string, n = 4): string {
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}
