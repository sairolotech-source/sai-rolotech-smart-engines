import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { runtimeErrorOverlay, loadPlatformPlugins } from "./platform-plugins";

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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("react/"))          return "vendor-react";
            if (id.includes("three"))                                        return "vendor-3d";
            if (id.includes("jspdf"))                                        return "vendor-pdf";
            if (id.includes("html2canvas"))                                  return "vendor-canvas";
            if (id.includes("konva") || id.includes("react-konva"))          return "vendor-konva";
            if (id.includes("lucide-react"))                                 return "vendor-icons";
            if (id.includes("zustand") || id.includes("immer"))             return "vendor-state";
            if (id.includes("framer-motion"))                                return "vendor-motion";
            if (id.includes("recharts") || id.includes("d3-"))              return "vendor-charts";
            if (id.includes("@radix-ui"))                                    return "vendor-radix";
            if (id.includes("monaco-editor"))                                return "vendor-monaco";
            return "vendor-misc";
          }
        },
      },
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
      "three",
      "@react-three/fiber",
      "@react-three/drei",
    ],
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
