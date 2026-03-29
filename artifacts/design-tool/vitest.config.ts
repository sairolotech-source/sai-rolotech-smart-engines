import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["src/lib/__tests__/setup.ts"],
    include: ["src/**/*.test.ts"],
    coverage: {
      reporter: ["text"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
