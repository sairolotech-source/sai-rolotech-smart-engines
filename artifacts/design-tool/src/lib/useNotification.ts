/**
 * useNotification — 3-channel notification system
 * Replaces setError("✅ ...") anti-pattern with typed channels.
 *
 * Usage:
 *   const { success, warn, error, clear } = useNotification(setStatusMessage);
 *   success("Roll tooling generated for 8 stations");
 *   warn("Thickness at upper limit — check material spec");
 *   error("DXF parse failed: no closed contour found");
 */

export type NotificationChannel = "success" | "warning" | "error" | "info";

export interface Notification {
  channel: NotificationChannel;
  message: string;
  timestamp: number;
}

type SetMessage = (msg: string) => void;

export interface NotificationHandle {
  success: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  clear: () => void;
}

/**
 * Returns typed notification dispatchers that write into a single string
 * state setter (backward-compatible with existing setError usage).
 *
 * Prefix:
 *  success → "✓ "
 *  warning → "⚠ "
 *  error   → "✕ "
 *  info    → "ℹ "
 */
export function makeNotifier(setMessage: SetMessage): NotificationHandle {
  return {
    success: (msg) => setMessage(`✓ ${msg}`),
    warn:    (msg) => setMessage(`⚠ ${msg}`),
    error:   (msg) => setMessage(`✕ ${msg}`),
    info:    (msg) => setMessage(`ℹ ${msg}`),
    clear:   ()    => setMessage(""),
  };
}

/**
 * Determine CSS class from notification prefix for styled display.
 * Works on any string written by makeNotifier.
 */
export function getNotificationStyle(msg: string): {
  textColor: string;
  bgColor: string;
  borderColor: string;
  channel: NotificationChannel;
} {
  if (msg.startsWith("✓")) return { textColor: "text-green-400",  bgColor: "bg-green-950/30",  borderColor: "border-green-700/40",  channel: "success" };
  if (msg.startsWith("⚠")) return { textColor: "text-amber-400",  bgColor: "bg-amber-950/30",  borderColor: "border-amber-700/40",  channel: "warning" };
  if (msg.startsWith("✕")) return { textColor: "text-red-400",    bgColor: "bg-red-950/30",    borderColor: "border-red-700/40",    channel: "error"   };
  if (msg.startsWith("ℹ")) return { textColor: "text-blue-400",   bgColor: "bg-blue-950/30",   borderColor: "border-blue-700/40",   channel: "info"    };
  return                           { textColor: "text-zinc-400",   bgColor: "bg-zinc-900/30",   borderColor: "border-zinc-700/40",   channel: "info"    };
}
