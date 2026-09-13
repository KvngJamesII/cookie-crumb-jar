# Cookie Crumb Jar 🍪

Minimal **Cookie Chain** cApp for the [Superteam Earn listing](https://superteam.fun/earn/listing/create-an-app-on-cookie-chain-app/).

Drop an on-chain **crumb** (Cookie Memo + optional COOK tip) into the official **Cookie Jar** builder vault. Nightly wallet support, live balances, tx confirmation, and activity views — all against `https://rpc.cookiescan.io`.

## Live demo

**https://kvngjamesii.github.io/cookie-crumb-jar/**

## Features (listing checklist)

| Requirement | Status |
|-------------|--------|
| Wallet connect (Nightly required) | ✅ Nightly + Phantom adapters |
| Display connected address | ✅ |
| Transaction execution on Cookie Chain | ✅ Memo + System transfer |
| Confirmation handling | ✅ `confirmTransaction` |
| Error handling / user feedback | ✅ status banners |
| App-specific data / activity | ✅ jar + wallet recent txs |
| Public deploy + open source README | ✅ |

## Addresses

| Role | Address |
|------|---------|
| Cookie Jar (Vault 1 tip destination) | `568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe` |
| Cookie Memo program | `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` |
| Deployer pubkey (empty — gas blocker for custom program) | `CnZ7jwwbTTVMGvmLg4GBE6u8o4eJX4ZH48SnfvTLupph` |
| RPC | `https://rpc.cookiescan.io` |
| Explorer | https://cookiescan.io |
| Bridge | https://bridge.cookiescan.io |

No custom program deploy was required: crumbs use genesis **Memo** + **System Program** tip to the official Cookie Jar. Deployer holds **0 COOK**, so a custom BPF deploy is blocked until funded (~$0.05).

## Quick start

```bash
cd web
npm install
npm run dev
```

Open the Vite URL, connect **Nightly** (add custom SVM network → RPC `https://rpc.cookiescan.io`), bridge a little COOK if needed, then **Drop crumb**.

```bash
npm run build   # output: web/dist (GitHub Pages base /cookie-crumb-jar/)
```

## How it works

1. User connects Nightly (or Phantom) pointed at Cookie Chain.
2. App builds a transaction:
   - `spl-memo` instruction with payload `cookie-crumb:<message>`
   - optional `SystemProgram.transfer` tip (default 10_000 lamports = 0.00001 COOK) to Cookie Jar
3. Wallet signs; app confirms on RPC and links the signature on CookieScan.

## Nightly setup

1. Install [Nightly](https://nightly.app/)
2. Add custom SVM network with RPC `https://rpc.cookiescan.io`
3. Bridge sCOOK → cCOOK at [bridge.cookiescan.io](https://bridge.cookiescan.io)
4. Use this app

Guide: [onboard.cookiechain.wtf](https://onboard.cookiechain.wtf/)

## Repo layout

```
cookie-capp/
  README.md
  SUBMIT.md
  REQUIREMENTS.md
  web/                 # Vite + React + @solana/web3.js cApp
  keys/deployer.pubkey.txt
```

## License

MIT
