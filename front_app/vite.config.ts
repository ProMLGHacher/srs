import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { kvt } from "@kvt/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [kvt(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/ws": { target: "ws://127.0.0.1:3001", ws: true },
    },
  },
});
