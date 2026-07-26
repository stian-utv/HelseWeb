import { defineConfig } from "vite";

/** Sett `VITE_BASE` i CI (f.eks. `/HelseWeb/`) for GitHub Pages-prosjektsider. */
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
