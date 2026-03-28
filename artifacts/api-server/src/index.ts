import express from "express";
import cors from "cors";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import path from "path";
import { existsSync, readFileSync } from "fs";
import apiRouter from "./routes/index.js";
import { SAI_ERROR_BRAND } from "./lib/ai-confidentiality";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

const PORT = process.env["PORT"]
  ? parseInt(process.env["PORT"])
  : process.env["API_PORT"]
  ? parseInt(process.env["API_PORT"])
  : 8080;

const FRONTEND_DIST = (() => {
  if (process.env["FRONTEND_DIST"] && existsSync(path.join(process.env["FRONTEND_DIST"], "index.html"))) {
    console.log("[server] FRONTEND_DIST (env):", process.env["FRONTEND_DIST"], "| index.html: found");
    return process.env["FRONTEND_DIST"];
  }
  const SELF_DIR = path.dirname(path.resolve(process.argv[1] ?? ""));
  const candidates = [
    path.resolve(SELF_DIR, "public"),
    path.resolve(process.cwd(), "artifacts/design-tool/dist/public"),
    path.resolve(process.cwd(), "../design-tool/dist/public"),
  ];
  for (const p of candidates) {
    if (existsSync(path.join(p, "index.html"))) {
      console.log("[server] FRONTEND_DIST:", p, "| index.html: found");
      return p;
    }
  }
  console.log("[server] FRONTEND_DIST: NOT FOUND — checked:", candidates.join(", "));
  return candidates[0];
})();

const app = express();

app.set("trust proxy", 1);

// Gzip compression — JS/CSS files 60-70% chote ho jaate hain (6.7MB → 2.4MB)
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.path}`);
  next();
});

app.use("/api", apiRouter);

app.use("/api", (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[${SAI_ERROR_BRAND.prefix}] Server Error:`, err.message);
  res.status(500).json({
    error: SAI_ERROR_BRAND.serverError,
    brand: SAI_ERROR_BRAND.prefix,
    timestamp: new Date().toISOString(),
  });
});

{
  const indexHtmlPath = path.join(FRONTEND_DIST, "index.html");
  const indexHtml = existsSync(indexHtmlPath)
    ? readFileSync(indexHtmlPath, "utf8")
    : null;
  console.log("[server] index.html cached:", indexHtml ? `${indexHtml.length} bytes` : "NOT FOUND");

  // JS/CSS assets — 1 saal cache (content-hash filename change hota hai automatically)
  app.use("/assets", express.static(path.join(FRONTEND_DIST, "assets"), {
    maxAge: "1y",
    immutable: true,
    etag: false,
    lastModified: false,
  }));

  // sw.js + manifest.json — HAMESHA no-cache (browser must always get latest version)
  app.get("/sw.js", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Content-Type", "application/javascript");
    res.sendFile(path.join(FRONTEND_DIST, "sw.js"));
  });
  app.get("/manifest.json", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Content-Type", "application/json");
    res.sendFile(path.join(FRONTEND_DIST, "manifest.json"));
  });

  // Icons + other static files — 1 day (ok to cache, rarely change)
  app.use(express.static(FRONTEND_DIST, {
    maxAge: "1d",
    etag: true,
  }));

  const RECOVERY_HTML = `<!DOCTYPE html><html><head><script>
(function(){
  var done = false;
  function go() {
    if (done) return; done = true;
    try { document.cookie = "_sw_ok=1;path=/;max-age=86400"; } catch(e){}
    window.location.replace("/?_app=1");
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs){
      var p = regs.map(function(r){return r.unregister()});
      return Promise.all(p);
    }).then(function(){
      if (typeof caches !== "undefined") {
        return caches.keys().then(function(ks){
          return Promise.all(ks.map(function(k){return caches.delete(k)}));
        });
      }
    }).then(go).catch(go);
  } else { go(); }
  setTimeout(go, 2000);
})();
</script></head><body style="background:#070710"></body></html>`;

  app.use((req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Clear-Site-Data", '"cache"');
    const alreadyCleaned = (req.headers.cookie || "").includes("_sw_ok=1");
    if (req.query._app || req.path !== "/" || alreadyCleaned) {
      if (indexHtml) {
        res.send(indexHtml);
      } else {
        res.status(503).send("Frontend not available. Path: " + indexHtmlPath);
      }
    } else {
      res.send(RECOVERY_HTML);
    }
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[api-server] listening on http://0.0.0.0:${PORT} [${IS_PRODUCTION ? "production" : "development"}]`);
});

if (IS_PRODUCTION && PORT !== 5000 && !process.env.ELECTRON) {
  const fallback = app.listen(5000, "0.0.0.0", () => {
    console.log(`[api-server] also listening on http://0.0.0.0:5000 [webview-fallback]`);
  });
  fallback.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.log(`[api-server] port 5000 already in use, skipping fallback`);
    } else {
      console.error(`[api-server] fallback port error:`, err.message);
    }
  });
}

export default app;
