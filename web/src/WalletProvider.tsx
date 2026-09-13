import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  NightlyWalletAdapter,
  PhantomWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { COOKIE_RPC, COOKIE_WSS } from "./lib/cookie";

export function CookieWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = COOKIE_RPC;
  const wallets = useMemo(
    () => [new NightlyWalletAdapter(), new PhantomWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{ commitment: "confirmed", wsEndpoint: COOKIE_WSS }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
