import express from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import path from "path";
import { existsSync, readFileSync } from "fs";
import apiRouter from "./routes/index.js";

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

const PORT = process.env["PORT"]
  ? parseInt(process.env["PORT"])
  : process.env["API_PORT"]
  ? parseInt(process.env["API_PORT"])
  : 8080;

const FRONTEND_DIST = (() => {
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

{
  const indexHtmlPath = path.join(FRONTEND_DIST, "index.html");
  const indexHtml = existsSync(indexHtmlPath)
    ? readFileSync(indexHtmlPath, "utf8")
    : null;
  console.log("[server] index.html cached:", indexHtml ? `${indexHtml.length} bytes` : "NOT FOUND");

  app.use(express.static(FRONTEND_DIST));
  app.use((_req, res) => {
    if (indexHtml) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(indexHtml);
    } else {
      res.status(503).send("Frontend not available. Path: " + indexHtmlPath);
    }
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[api-server] listening on http://0.0.0.0:${PORT} [${IS_PRODUCTION ? "production" : "development"}]`);
});

if (IS_PRODUCTION && PORT !== 5000) {
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
