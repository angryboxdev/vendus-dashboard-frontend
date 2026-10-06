import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Teste do Portal do Colaborador no telemóvel via túnel HTTPS (cloudflared → localhost:5173).
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": {
        target: "http://localhost:3333",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
