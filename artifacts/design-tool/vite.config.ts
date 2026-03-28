import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { runtimeErrorOverlay, loadPlatformPlugins } from "./platform-plugins";
import { visualizer } from "rollup-plugin-visualizer";

const rawPort = process.env.PORT ?? "5000";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(await loadPlatformPlugins(import.meta.dirname)),
    ...(process.env["ANALYZE"] ? [visualizer({ filename: "dist/stats.json", json: true, gzipSize: true })] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "esnext",
    chunkSizeWarningLimit: 2000,
    modulePreload: {
      polyfill: true,
    },
    rollupOptions: {
      output: {},
    },
    minify: "esbuild",
  },
  esbuild: {
    legalComments: "none",
    target: "esnext",
  },
  optimizeDeps: {
    include: [
      "react", "react-dom", "react/jsx-runtime",
      "zustand", "zustand/middleware",
      "lucide-react",
      "@tanstack/react-query",
      "wouter",
      "framer-motion",
    ],
    // three/@react-three are NOT here — they load lazily on demand
    esbuildOptions: {
      target: "esnext",
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
