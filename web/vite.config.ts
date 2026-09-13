import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// GitHub Pages project site: https://kvngjamesii.github.io/cookie-crumb-jar/
export default defineConfig({
  plugins: [react(), nodePolyfills({ protocolImports: true })],
  base: "/cookie-crumb-jar/",
  define: {
    "process.env": {},
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1600,
  },
});
