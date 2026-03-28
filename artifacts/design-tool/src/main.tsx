import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// ── Global crash shield for the renderer process ──────────────────────────────
// Catches any JS error that escapes React's error boundary (e.g. async callbacks,
// event handlers outside components, third-party libs, etc.)
window.addEventListener("error", (event) => {
  console.error("[Global] Uncaught error:", event.error ?? event.message);
  try {
    const prev = JSON.parse(localStorage.getItem("sai-rolotech-errors") ?? "[]");
    prev.unshift({ ts: new Date().toISOString(), msg: String(event.message), file: event.filename });
    if (prev.length > 20) prev.length = 20;
    localStorage.setItem("sai-rolotech-errors", JSON.stringify(prev));
  } catch { /* ignore */ }
  // Don't call event.preventDefault() — let DevTools still show the error
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
  console.error("[Global] Unhandled Promise Rejection:", msg);
  try {
    const prev = JSON.parse(localStorage.getItem("sai-rolotech-errors") ?? "[]");
    prev.unshift({ ts: new Date().toISOString(), msg: `Promise rejection: ${msg}` });
    if (prev.length > 20) prev.length = 20;
    localStorage.setItem("sai-rolotech-errors", JSON.stringify(prev));
  } catch { /* ignore */ }
  event.preventDefault(); // prevent console noise for expected rejections
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary fullScreen>
    <App />
  </ErrorBoundary>
);
