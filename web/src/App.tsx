import { useCallback, useEffect, useMemo, useState } from "react";
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
  displayMemo,
  fetchJarActivity,
  fetchUserSignatures,
  formatTime,
  type CrumbActivity,
} from "./lib/crumbs";

type Status =
  | { kind: "idle" }
  | { kind: "pending"; note: string }
  | { kind: "success"; sig: string }
  | { kind: "error"; message: string };

const TIP_PRESETS = [
  { label: "Memo only", value: 0 },
  { label: "0.00001 COOK", value: 10_000 },
  { label: "0.0001 COOK", value: 100_000 },
  { label: "0.001 COOK", value: 1_000_000 },
];

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
  const [feedFilter, setFeedFilter] = useState<"crumbs" | "all">("crumbs");
  const [copied, setCopied] = useState(false);

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
      const act = await fetchJarActivity(connection, 16);
      setActivity(act);
    } catch (e) {
      console.warn("refresh failed", e);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 12_000);
    return () => clearInterval(id);
  }, [refresh]);

  const feed = useMemo(() => {
    if (feedFilter === "all") return activity;
    const crumbs = activity.filter((a) => a.isCrumb);
    return crumbs.length ? crumbs : activity;
  }, [activity, feedFilter]);

  const crumbCount = activity.filter((a) => a.isCrumb).length;

  async function copyAddr(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

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
    if (balance != null && tip > 0 && balance < tip + 5000) {
      setStatus({
        kind: "error",
        message: "Not enough COOK for tip + fees. Bridge via bridge.cookiescan.io",
      });
      return;
    }
    setBusy(true);
    setStatus({ kind: "pending", note: "Building & sending Cookie Chain tx…" });
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
      setStatus({ kind: "pending", note: `Confirming ${shortAddr(sig, 6)} on CookieScan…` });

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
          <p className="eyebrow">Cookie Chain · SVM cApp</p>
          <h1>🍪 Cookie Crumb Jar</h1>
          <p className="lede">
            Leave a permanent on-chain crumb (Cookie Memo + optional COOK tip) in the community{" "}
            <a href={explorerAddress(COOKIE_JAR.toBase58())} target="_blank" rel="noreferrer">
              Cookie Jar
            </a>
            . Nightly-ready · live on{" "}
            <a href={COOKIE_EXPLORER} target="_blank" rel="noreferrer">
              CookieScan
            </a>
            .
          </p>
          <ol className="steps">
            <li>Connect Nightly (Cookie RPC)</li>
            <li>Write a crumb + optional tip</li>
            <li>Confirm tx → open on CookieScan</li>
          </ol>
        </div>
        <div className="hero-actions">
          <WalletMultiButton />
          <button type="button" className="ghost" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>

      <section className="grid stats">
        <div className="card">
          <h3>Network</h3>
          <p className="mono">rpc.cookiescan.io</p>
          <p>
            Slot{" "}
            <a href={`${COOKIE_EXPLORER}`} target="_blank" rel="noreferrer">
              {slot ?? "…"}
            </a>
          </p>
          <p>
            <a className="btn-link" href={COOKIE_EXPLORER} target="_blank" rel="noreferrer">
              Open CookieScan ↗
            </a>
          </p>
        </div>
        <div className="card">
          <h3>Cookie Jar</h3>
          <p className="mono" title={COOKIE_JAR.toBase58()}>
            {shortAddr(COOKIE_JAR.toBase58(), 6)}
          </p>
          <p className="big">{jarBalance == null ? "…" : formatCook(jarBalance, 4)}</p>
          <p className="muted">Vault 1 · builder fund</p>
          <div className="row-links">
            <a href={explorerAddress(COOKIE_JAR.toBase58())} target="_blank" rel="noreferrer">
              CookieScan
            </a>
            <button type="button" className="linkish" onClick={() => void copyAddr(COOKIE_JAR.toBase58())}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <div className="card">
          <h3>Your wallet</h3>
          {connected && publicKey ? (
            <>
              <p className="mono">{shortAddr(publicKey.toBase58(), 6)}</p>
              <p className="big">{balance == null ? "…" : formatCook(balance)}</p>
              <div className="row-links">
                <a href={explorerAddress(publicKey.toBase58())} target="_blank" rel="noreferrer">
                  CookieScan
                </a>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => void copyAddr(publicKey.toBase58())}
                >
                  Copy
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              Connect Nightly → custom SVM → RPC <code>{COOKIE_RPC}</code>
            </p>
          )}
        </div>
      </section>

      <section className="card drop">
        <h2>Drop a crumb</h2>
        <p className="muted">
          Builds a Cookie Chain transaction: Memo <code>cookie-crumb:…</code>
          {tip > 0 ? " + tip to Cookie Jar" : " (memo-only)"}. Need COOK?{" "}
          <a href={COOKIE_BRIDGE} target="_blank" rel="noreferrer">
            Bridge at bridge.cookiescan.io
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
        <p className="charcount">{message.length}/200</p>
        <div className="tip-row">
          <span className="muted">Tip presets</span>
          <div className="chips tip-chips">
            {TIP_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={tip === p.value ? "chip on" : "chip"}
                onClick={() => setTip(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label>
          Custom tip (lamports)
          <input
            type="number"
            min={0}
            step={1000}
            value={tip}
            onChange={(e) => setTip(Number(e.target.value) || 0)}
          />
        </label>
        <p className="muted">Selected tip = {formatCook(tip)}</p>
        <button className="primary" disabled={busy || !connected} onClick={() => void dropCrumb()}>
          {busy ? "Dropping…" : "Drop crumb on Cookie Chain"}
        </button>

        {status.kind === "pending" && <div className="banner pending">{status.note}</div>}
        {status.kind === "success" && (
          <div className="banner ok">
            Confirmed on Cookie Chain!{" "}
            <a href={explorerTx(status.sig)} target="_blank" rel="noreferrer">
              View tx on CookieScan ↗
            </a>
          </div>
        )}
        {status.kind === "error" && <div className="banner err">{status.message}</div>}
      </section>

      <section className="card feed">
        <div className="feed-head">
          <div>
            <h2>Crumb activity feed</h2>
            <p className="muted">
              Live from Cookie Jar · {crumbCount} crumb{crumbCount === 1 ? "" : "s"} in last{" "}
              {activity.length} jar txs
            </p>
          </div>
          <div className="chips">
            <button
              type="button"
              className={feedFilter === "crumbs" ? "chip on" : "chip"}
              onClick={() => setFeedFilter("crumbs")}
            >
              Crumbs
            </button>
            <button
              type="button"
              className={feedFilter === "all" ? "chip on" : "chip"}
              onClick={() => setFeedFilter("all")}
            >
              All jar txs
            </button>
            <a
              className="chip"
              href={explorerAddress(COOKIE_JAR.toBase58())}
              target="_blank"
              rel="noreferrer"
            >
              CookieScan jar ↗
            </a>
          </div>
        </div>
        <ul className="feed-list">
          {feed.length === 0 && (
            <li className="muted">No activity yet — be the first crumb.</li>
          )}
          {feed.map((a) => (
            <li key={a.signature} className={a.isCrumb ? "crumb-item" : ""}>
              <div className="feed-top">
                {a.isCrumb ? <span className="tag">crumb</span> : <span className="tag dim">jar</span>}
                <span className={a.err ? "bad" : "good"}>{a.err ? "failed" : "ok"}</span>
                <span className="muted time">{formatTime(a.blockTime)}</span>
                <a href={explorerTx(a.signature)} target="_blank" rel="noreferrer">
                  {shortAddr(a.signature, 8)} ↗
                </a>
              </div>
              {a.memo && <div className="memo">“{displayMemo(a.memo)}”</div>}
              <div className="feed-meta muted">
                {a.tipLamports != null && <span>tip {formatCook(a.tipLamports)}</span>}
                {a.feePayer && (
                  <a href={explorerAddress(a.feePayer)} target="_blank" rel="noreferrer">
                    from {shortAddr(a.feePayer, 4)}
                  </a>
                )}
                <span>slot {a.slot}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Your recent txs</h2>
          <ul className="list">
            {!connected && <li className="muted">Connect a wallet to see Cookie Chain history.</li>}
            {connected && mySigs.length === 0 && (
              <li className="muted">No signatures yet — drop a crumb.</li>
            )}
            {mySigs.map((s) => (
              <li key={s.signature}>
                <a href={explorerTx(s.signature)} target="_blank" rel="noreferrer">
                  {shortAddr(s.signature, 8)}
                </a>
                <span className={s.err ? "bad" : "good"}>{s.err ? "failed" : "ok"}</span>
                <span className="muted time">{formatTime(s.blockTime)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>How it works</h2>
          <ol className="howto">
            <li>
              Wallet signs against <code>https://rpc.cookiescan.io</code>
            </li>
            <li>
              Memo program <code>MemoSq4…GmfcHr</code> stores your crumb
            </li>
            <li>Optional System transfer tips the Cookie Jar vault</li>
            <li>
              Confirmation + links on{" "}
              <a href={COOKIE_EXPLORER} target="_blank" rel="noreferrer">
                cookiescan.io
              </a>
            </li>
          </ol>
        </div>
      </section>

      <section className="card links">
        <h2>Cookie ecosystem</h2>
        <div className="chips">
          <a href={COOKIE_EXPLORER} target="_blank" rel="noreferrer">
            CookieScan
          </a>
          <a href={COOKIE_ONBOARD} target="_blank" rel="noreferrer">
            Onboard / Nightly
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
      </section>

      <footer>
        <p>
          Open source ·{" "}
          <a href="https://github.com/KvngJamesII/cookie-crumb-jar" target="_blank" rel="noreferrer">
            GitHub
          </a>{" "}
          · Cookie Chain SVM · Jar{" "}
          <a href={explorerAddress(COOKIE_JAR.toBase58())} target="_blank" rel="noreferrer">
            {shortAddr(COOKIE_JAR.toBase58(), 4)}
          </a>
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
