import path from "path";

export async function loadPlatformPlugins(rootDir: string) {
  if (process.env.NODE_ENV === "production" || process.env.REPL_ID === undefined) {
    return [];
  }
  const plugins = [];
  const cartographer = await import("@replit/vite-plugin-cartographer");
  plugins.push(cartographer.cartographer({ root: path.resolve(rootDir, "..") }));
  return plugins;
}

export { default as runtimeErrorOverlay } from "@replit/vite-plugin-runtime-error-modal";
