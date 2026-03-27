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
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          // === NEVER BUNDLE ON STARTUP — fully lazy (Rollup decides split) ===
          // Three.js / WebGL — only needed in 3D views, loaded on-demand.
          // Must match: "three", "@react-three/", "postprocessing", "three-csg",
          // AND pnpm peer-dep folders like "camera-controls@x_three@y",
          // "maath@x_three@y", "meshline@x_three@y", "gainmap-js@x_three@y".
          if (
            id.includes("three") ||        // catches: three, three-csg, *_three@*, node_modules/three/
            id.includes("@react-three/") ||
            id.includes("postprocessing") ||
            id.includes("maath") ||        // @react-three/drei math util (pnpm: maath@x_three@y)
            id.includes("meshline") ||     // @react-three/drei line renderer
            id.includes("gainmap-js") ||   // @monogrid/gainmap-js (drei dep)
            id.includes("camera-controls") // drei camera helper
          ) return undefined;

          // Offline AI — 14MB, only when user opens WebLLM feature
          if (id.includes("@mlc-ai/web-llm")) return undefined;

          // Mobile-only — never on web
          if (id.includes("@capacitor/")) return undefined;

          // Monaco editor — only when code editor opens
          if (id.includes("monaco-editor")) return undefined;

          // PDF/Export — only on report generation
          if (id.includes("jspdf") || id.includes("jszip") || id.includes("file-saver")) return "vendor-pdf";
          if (id.includes("html2canvas")) return "vendor-canvas";

          // === EAGER VENDORS (always loaded, but split for parallel download) ===

          // React core — must load first
          if (id.includes("react-dom") || id.includes("react/")) return "vendor-react";

          // Canvas/Drawing
          if (id.includes("konva") || id.includes("react-konva")) return "vendor-konva";

          // Icons
          if (id.includes("lucide-react")) return "vendor-icons";

          // State management
          if (id.includes("zustand") || id.includes("immer")) return "vendor-state";

          // Animation
          if (id.includes("framer-motion")) return "vendor-motion";

          // Charts
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";

          // UI components
          if (id.includes("@radix-ui") || id.includes("vaul") || id.includes("sonner") || id.includes("cmdk")) return "vendor-radix";

          // Date utilities
          if (id.includes("date-fns") || id.includes("react-day-picker")) return "vendor-date";

          // Forms/validation
          if (id.includes("zod") || id.includes("react-hook-form") || id.includes("@hookform")) return "vendor-forms";

          // Query/networking
          if (id.includes("@tanstack/react-query") || id.includes("wouter")) return "vendor-query";

          // UI utilities
          if (id.includes("tailwind-merge") || id.includes("class-variance") || id.includes("clsx")) return "vendor-ui-utils";

          // Carousel / misc medium UI
          if (id.includes("embla-carousel") || id.includes("react-colorful") || id.includes("input-otp")) return "vendor-ui-extra";

          // Workspace internal packages
          if (id.includes("@workspace/")) return "vendor-workspace";

          // Everything else — small utilities (uuid, etc.)
          return "vendor-misc";
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
