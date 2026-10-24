import { defineConfig } from 'vite';

export default defineConfig({
  // This project is a static Vite site deployed to Cloudflare Pages.
  // Keep the config explicit so Wrangler does not try to rewrite it as a
  // Cloudflare Vite/Workers project during `wrangler pages deploy`.
  plugins: [],
  server: { host: true },
});
