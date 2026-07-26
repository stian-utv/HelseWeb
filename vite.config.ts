import { defineConfig, type Plugin } from "vite";

/** Sett `VITE_BASE` i CI (f.eks. `/HelseWeb/`) for GitHub Pages-prosjektsider. */
const base = process.env.VITE_BASE || "/";

const productionCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
].join("; ");

const developmentCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' ws: wss:",
  "form-action 'self'",
  "manifest-src 'self'",
].join("; ");

function cspPlugin(): Plugin {
  return {
    name: "helseweb-csp",
    transformIndexHtml(html, ctx) {
      const csp = ctx.server ? developmentCsp : productionCsp;
      return html.replace(
        "<!-- CSP injectes av Vite (strengere i produksjon). -->",
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

export default defineConfig({
  base,
  plugins: [cspPlugin()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: "dist",
    // Ikke publiser source maps på Pages (mindre innsyn i kildekode).
    sourcemap: false,
  },
});
