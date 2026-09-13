import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { CookieWalletProvider } from "./WalletProvider";
import {
  COOKIE_BRIDGE,
  COOKIE_DAS,
  COOKIE_DOCS,
  COOKIE_EXPLORER,
  COOKIE_JAR,
  COOKIE_ONBOARD,
  COOKIE_RPC,
  DEFAULT_TIP_LAMPORTS,
  explorerAddress,
  explorerTx,
  formatCook,
  shortAddr,
} from "./lib/cookie";
import {
  buildCrumbTransaction,
  fetchJarActivity,
  fetchUserSignatures,
  type CrumbActivity,
} from "./lib/crumbs";

type Status =
  | { kind: "idle" }
  | { kind: "pending"; note: string }
  | { kind: "success"; sig: string }
  | { kind: "error"; message: string };

function CrumbApp() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [message, setMessage] = useState("gm cookie chain 🍪");
  const [tip, setTip] = useState(DEFAULT_TIP_LAMPORTS);
  const [balance, setBalance] = useState<number | null>(null);
  const [jarBalance, setJarBalance] = useState<number | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [activity, setActivity] = useState<CrumbActivity[]>([]);
  const [mySigs, setMySigs] = useState<
    { signature: string; err: unknown; blockTime: number | null }[]
  >([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, jar] = await Promise.all([
        connection.getSlot("confirmed"),
        connection.getBalance(COOKIE_JAR, "confirmed"),
      ]);
      setSlot(s);
      setJarBalance(jar);
      if (publicKey) {
        const bal = await connection.getBalance(publicKey, "confirmed");
        setBalance(bal);
        const sigs = await fetchUserSignatures(connection, publicKey, 8);
        setMySigs(
          sigs.map((x) => ({
            signature: x.signature,
            err: x.err,
            blockTime: x.blockTime ?? null,
          })),
        );
      } else {
        setBalance(null);
        setMySigs([]);
      }
      const act = await fetchJarActivity(connection, 10);
      setActivity(act);
    } catch (e) {
      console.warn("refresh failed", e);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function dropCrumb() {
    if (!publicKey) {
      setStatus({ kind: "error", message: "Connect Nightly (or Phantom) first." });
      return;
    }
    const text = message.trim();
    if (!text) {
      setStatus({ kind: "error", message: "Write a crumb message." });
      return;
    }
    setBusy(true);
    setStatus({ kind: "pending", note: "Building & sending transaction…" });
    try {
      const tx = buildCrumbTransaction({
        payer: publicKey,
        message: text,
        tipLamports: tip,
      });
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const sig = await sendTransaction(tx, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
      setStatus({ kind: "pending", note: `Confirming ${shortAddr(sig, 6)}…` });

      const conf = await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      if (conf.value.err) {
        setStatus({
          kind: "error",
          message: `On-chain error: ${JSON.stringify(conf.value.err)}`,
        });
      } else {
        setStatus({ kind: "success", sig });
        setMessage("");
        await refresh();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ kind: "error", message: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Cookie Chain cApp</p>
          <h1>🍪 Cookie Crumb Jar</h1>
          <p className="lede">
            Drop an on-chain crumb (Memo + optional tip) into the community{" "}
            <a href={explorerAddress(COOKIE_JAR.toBase58())} target="_blank" rel="noreferrer">
              Cookie Jar
            </a>
            . Built for Nightly on Cookie Chain SVM — sub-second finality, near-zero fees.
          </p>
        </div>
        <WalletMultiButton />
      </header>

      <section className="grid stats">
        <div className="card">
          <h3>Network</h3>
          <p className="mono">RPC {COOKIE_RPC.replace("https://", "")}</p>
          <p>Slot: {slot ?? "…"}</p>
          <p>
            Explorer:{" "}
            <a href={COOKIE_EXPLORER} target="_blank" rel="noreferrer">
              cookiescan.io
            </a>
          </p>
        </div>
        <div className="card">
          <h3>Cookie Jar</h3>
          <p className="mono">{shortAddr(COOKIE_JAR.toBase58(), 6)}</p>
          <p>{jarBalance == null ? "…" : formatCook(jarBalance, 4)}</p>
          <p className="muted">Vault 1 · builder fund</p>
        </div>
        <div className="card">
          <h3>Your wallet</h3>
          {connected && publicKey ? (
            <>
              <p className="mono">{shortAddr(publicKey.toBase58(), 6)}</p>
              <p>{balance == null ? "…" : formatCook(balance)}</p>
              <p>
                <a
                  href={explorerAddress(publicKey.toBase58())}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on CookieScan
                </a>
              </p>
            </>
          ) : (
            <p className="muted">Connect Nightly with Cookie RPC to continue.</p>
          )}
        </div>
      </section>

      <section className="card drop">
        <h2>Drop a crumb</h2>
        <p className="muted">
          Writes a Memo on Cookie Chain and (optionally) tips the Cookie Jar. Need COOK?
          Bridge sCOOK → cCOOK via{" "}
          <a href={COOKIE_BRIDGE} target="_blank" rel="noreferrer">
            bridge.cookiescan.io
          </a>
          .
        </p>
        <label>
          Message
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
            placeholder="say something on-chain"
          />
        </label>
        <label>
          Tip to Cookie Jar (lamports)
          <input
            type="number"
            min={0}
            step={1000}
            value={tip}
            onChange={(e) => setTip(Number(e.target.value) || 0)}
          />
        </label>
        <p className="muted">
          Default tip {DEFAULT_TIP_LAMPORTS} lamports = {formatCook(DEFAULT_TIP_LAMPORTS)}. Set 0
          for memo-only.
        </p>
        <button className="primary" disabled={busy || !connected} onClick={() => void dropCrumb()}>
          {busy ? "Dropping…" : "Drop crumb on Cookie Chain"}
        </button>

        {status.kind === "pending" && (
          <div className="banner pending">{status.note}</div>
        )}
        {status.kind === "success" && (
          <div className="banner ok">
            Confirmed!{" "}
            <a href={explorerTx(status.sig)} target="_blank" rel="noreferrer">
              {shortAddr(status.sig, 8)}
            </a>
          </div>
        )}
        {status.kind === "error" && (
          <div className="banner err">{status.message}</div>
        )}
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Jar activity</h2>
          <p className="muted">Recent transfers touching the Cookie Jar.</p>
          <ul className="list">
            {activity.length === 0 && <li className="muted">No recent activity yet.</li>}
            {activity.map((a) => (
              <li key={a.signature}>
                <a href={explorerTx(a.signature)} target="_blank" rel="noreferrer">
                  {shortAddr(a.signature, 8)}
                </a>
                <span className={a.err ? "bad" : "good"}>
                  {a.err ? "failed" : "ok"}
                </span>
                {a.memo && <div className="memo">{a.memo}</div>}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Your recent txs</h2>
          <ul className="list">
            {!connected && <li className="muted">Connect a wallet to see history.</li>}
            {connected && mySigs.length === 0 && (
              <li className="muted">No signatures yet on Cookie Chain.</li>
            )}
            {mySigs.map((s) => (
              <li key={s.signature}>
                <a href={explorerTx(s.signature)} target="_blank" rel="noreferrer">
                  {shortAddr(s.signature, 8)}
                </a>
                <span className={s.err ? "bad" : "good"}>
                  {s.err ? "failed" : "ok"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card links">
        <h2>Cookie ecosystem</h2>
        <div className="chips">
          <a href={COOKIE_ONBOARD} target="_blank" rel="noreferrer">
            Onboard / Nightly setup
          </a>
          <a href={COOKIE_BRIDGE} target="_blank" rel="noreferrer">
            Bridge COOK
          </a>
          <a href={COOKIE_DOCS} target="_blank" rel="noreferrer">
            Docs
          </a>
          <a href={COOKIE_DAS} target="_blank" rel="noreferrer">
            DAS API
          </a>
          <a href="https://cookieswap.fun/" target="_blank" rel="noreferrer">
            Cookieswap
          </a>
          <a href="https://cookiebox.app/" target="_blank" rel="noreferrer">
            Cookiebox
          </a>
        </div>
        <p className="muted setup">
          Nightly: add custom SVM network → RPC <code>{COOKIE_RPC}</code>. See{" "}
          <a href={COOKIE_ONBOARD} target="_blank" rel="noreferrer">
            onboard.cookiechain.wtf
          </a>
          .
        </p>
      </section>

      <footer>
        <p>
          Open source · Cookie Chain SVM · Memo{" "}
          <code>MemoSq4…GmfcHr</code> · Jar{" "}
          <code>{shortAddr(COOKIE_JAR.toBase58(), 4)}</code>
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <CookieWalletProvider>
      <CrumbApp />
    </CookieWalletProvider>
  );
}
