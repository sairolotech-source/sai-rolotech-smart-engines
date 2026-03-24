import { useState, useEffect, useCallback } from "react";
import { useAppVersion } from "@/lib/appVersion";

const ADMIN_API = "/api/admin";

interface User {
  id: string;
  name: string;
  mobile: string;
  key: string;
  hwId: string;
  systemInfo: Record<string, string>;
  token: string;
  activatedAt: string;
  lastSeenAt: string;
  blocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  ipAddress: string;
}

interface Stats {
  total: number;
  active: number;
  blocked: number;
  todayNew: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d pehle`;
  if (hrs > 0) return `${hrs}h pehle`;
  if (mins > 0) return `${mins}m pehle`;
  return "Abhi";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminPanel() {
  const appVersion = useAppVersion();
  const [password, setPassword] = useState(() => sessionStorage.getItem("sai_admin_pwd") || "");
  const [loggedIn, setLoggedIn] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "blocked">("all");
  const [blockReason, setBlockReason] = useState("");
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async (pwd: string) => {
    setLoading(true);
    setError("");
    try {
      const [uRes, sRes] = await Promise.all([
        fetch(`${ADMIN_API}/users`, { headers: { "x-admin-password": pwd } }),
        fetch(`${ADMIN_API}/stats`, { headers: { "x-admin-password": pwd } }),
      ]);
      if (uRes.status === 401) {
        setError("Password galat hai!");
        setLoggedIn(false);
        return;
      }
      const uData = await uRes.json() as { ok: boolean; users: User[] };
      const sData = await sRes.json() as { ok: boolean } & Stats;
      if (uData.ok) { setUsers(uData.users); setLoggedIn(true); }
      if (sData.ok) setStats(sData);
    } catch {
      setError("Server se connect nahi ho pa raha");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async () => {
    if (!password.trim()) { setError("Password daalo"); return; }
    sessionStorage.setItem("sai_admin_pwd", password);
    await fetchData(password);
  };

  const blockUser = async (id: string, reason: string) => {
    const res = await fetch(`${ADMIN_API}/users/${id}/block`, {
      method: "POST",
      headers: { "x-admin-password": password, "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json() as { ok: boolean; message: string };
    if (data.ok) { showToast(data.message, "ok"); await fetchData(password); }
    else showToast(data.message, "err");
    setBlockingId(null);
    setBlockReason("");
  };

  const unblockUser = async (id: string) => {
    const res = await fetch(`${ADMIN_API}/users/${id}/unblock`, {
      method: "POST",
      headers: { "x-admin-password": password },
    });
    const data = await res.json() as { ok: boolean; message: string };
    if (data.ok) { showToast(data.message, "ok"); await fetchData(password); }
    else showToast(data.message, "err");
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`"${name}" ka record delete karna chahte hain?`)) return;
    const res = await fetch(`${ADMIN_API}/users/${id}`, {
      method: "DELETE",
      headers: { "x-admin-password": password },
    });
    const data = await res.json() as { ok: boolean; message: string };
    if (data.ok) { showToast(data.message, "ok"); await fetchData(password); }
  };

  useEffect(() => {
    if (loggedIn && password) {
      const interval = setInterval(() => fetchData(password), 30000);
      return () => clearInterval(interval);
    }
  }, [loggedIn, password, fetchData]);

  const filtered = users.filter(u => {
    const matchSearch = !search || [u.name, u.mobile, u.systemInfo?.hostname ?? "", u.ipAddress]
      .some(v => v.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === "all" || (filter === "blocked" ? u.blocked : !u.blocked);
    return matchSearch && matchFilter;
  });

  // ── Login Screen ──────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div style={{
        minHeight: "100vh", background: "#070710", display: "flex",
        alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', sans-serif",
      }}>
        <div style={{
          background: "#0f0f1f", border: "1px solid #1e1e3f", borderRadius: 16,
          padding: "40px 48px", width: 380, boxShadow: "0 8px 40px rgba(249,115,22,0.15)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
            <h1 style={{ color: "#f97316", margin: 0, fontSize: 22, fontWeight: 700 }}>SAI Rolotech Admin</h1>
            <p style={{ color: "#71717a", fontSize: 13, margin: "8px 0 0" }}>License Management Panel</p>
          </div>
          {error && (
            <div style={{ background: "#1f0000", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
              ⚠ {error}
            </div>
          )}
          <label style={{ color: "#d4d4d8", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Admin Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            placeholder="Admin password daalo"
            style={{
              width: "100%", padding: "12px 14px", fontSize: 15, background: "#1a1a2e",
              border: "2px solid #27272a", borderRadius: 8, color: "#fff", outline: "none",
              boxSizing: "border-box", marginBottom: 16,
            }}
          />
          <button
            onClick={login}
            disabled={loading}
            style={{
              width: "100%", padding: "12px", fontSize: 15, fontWeight: 700,
              background: loading ? "#4a3515" : "linear-gradient(135deg,#f97316,#d97706)",
              color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Verifying..." : "Login"}
          </button>
          <p style={{ color: "#52525b", fontSize: 11, textAlign: "center", marginTop: 16 }}>
            SAI Rolotech Smart Engines {appVersion}
          </p>
        </div>
      </div>
    );
  }

  // ── Admin Dashboard ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#070710", fontFamily: "'Segoe UI', sans-serif", color: "#e4e4e7" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.type === "ok" ? "#052e16" : "#1f0000",
          border: `1px solid ${toast.type === "ok" ? "#16a34a" : "#ef4444"}`,
          color: toast.type === "ok" ? "#4ade80" : "#f87171",
          borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 500,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {toast.type === "ok" ? "✓ " : "✗ "}{toast.msg}
        </div>
      )}

      {/* Block Reason Modal */}
      {blockingId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#0f0f1f", border: "1px solid #27272a", borderRadius: 14,
            padding: "28px 32px", width: 360,
          }}>
            <h3 style={{ color: "#ef4444", margin: "0 0 16px", fontSize: 16 }}>🚫 User Block Karo</h3>
            <label style={{ color: "#a1a1aa", fontSize: 13, display: "block", marginBottom: 6 }}>Block karne ki wajah (optional)</label>
            <input
              type="text"
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="e.g. License expired, Misuse..."
              style={{
                width: "100%", padding: "10px 12px", background: "#1a1a2e",
                border: "1px solid #27272a", borderRadius: 8, color: "#fff",
                fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => blockUser(blockingId, blockReason)}
                style={{ flex: 1, padding: "10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
              >
                Block Karo
              </button>
              <button
                onClick={() => { setBlockingId(null); setBlockReason(""); }}
                style={{ flex: 1, padding: "10px", background: "#27272a", color: "#a1a1aa", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#0f0f1f", borderBottom: "1px solid #1e1e3f", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f97316" }}>
            🛠 SAI Rolotech Admin Panel
          </h1>
          <p style={{ margin: "2px 0 0", color: "#71717a", fontSize: 12 }}>License Management — www.sairolotech.com</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => fetchData(password)}
            style={{ padding: "8px 16px", background: "#1a1a2e", border: "1px solid #27272a", borderRadius: 8, color: "#a1a1aa", cursor: "pointer", fontSize: 13 }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => { sessionStorage.removeItem("sai_admin_pwd"); setLoggedIn(false); setPassword(""); }}
            style={{ padding: "8px 16px", background: "#1f0000", border: "1px solid #dc2626", borderRadius: 8, color: "#ef4444", cursor: "pointer", fontSize: 13 }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Stats Cards */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
            {[
              { label: "Kul Users", value: stats.total, color: "#f97316", icon: "👥" },
              { label: "Active", value: stats.active, color: "#22c55e", icon: "✅" },
              { label: "Blocked", value: stats.blocked, color: "#ef4444", icon: "🚫" },
              { label: "Aaj Naye", value: stats.todayNew, color: "#a78bfa", icon: "🆕" },
            ].map(s => (
              <div key={s.label} style={{
                background: "#0f0f1f", border: `1px solid ${s.color}33`,
                borderRadius: 12, padding: "18px 20px",
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ color: "#71717a", fontSize: 13 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters & Search */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Naam, Mobile ya Computer se search..."
            style={{
              flex: 1, minWidth: 220, padding: "10px 14px", background: "#0f0f1f",
              border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7",
              fontSize: 14, outline: "none",
            }}
          />
          {(["all", "active", "blocked"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "10px 18px", borderRadius: 8, border: "1px solid",
                cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                background: filter === f ? (f === "blocked" ? "#dc2626" : f === "active" ? "#16a34a" : "#f97316") : "#0f0f1f",
                color: filter === f ? "#fff" : "#71717a",
                borderColor: filter === f ? "transparent" : "#27272a",
              }}
            >
              {f === "all" ? "Sab" : f === "active" ? "Active" : "Blocked"}
            </button>
          ))}
        </div>

        {/* Users Table */}
        <div style={{ background: "#0f0f1f", border: "1px solid #1e1e3f", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#0a0a1a", borderBottom: "1px solid #1e1e3f" }}>
                  {["#", "Naam", "Mobile", "System / IP", "License Key", "Activate Hua", "Last Seen", "Status", "Action"].map(h => (
                    <th key={h} style={{
                      padding: "12px 14px", textAlign: "left", fontSize: 12,
                      color: "#71717a", fontWeight: 600, whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "#52525b" }}>
                      {loading ? "Loading..." : "Koi user nahi mila"}
                    </td>
                  </tr>
                ) : filtered.map((u, idx) => (
                  <tr key={u.id} style={{
                    borderBottom: "1px solid #1a1a2e",
                    background: u.blocked ? "rgba(220,38,38,0.04)" : "transparent",
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = u.blocked ? "rgba(220,38,38,0.08)" : "rgba(249,115,22,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = u.blocked ? "rgba(220,38,38,0.04)" : "transparent")}
                  >
                    <td style={{ padding: "12px 14px", color: "#52525b", fontSize: 13 }}>{idx + 1}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "#e4e4e7", fontSize: 14, whiteSpace: "nowrap" }}>
                      {u.name}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#a1a1aa", fontSize: 13, whiteSpace: "nowrap" }}>
                      📱 {u.mobile}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#71717a" }}>
                      <div style={{ fontWeight: 500, color: "#a1a1aa" }}>{u.systemInfo?.hostname || "—"}</div>
                      <div>{u.systemInfo?.platform || ""} {u.systemInfo?.os || ""}</div>
                      <div style={{ color: "#52525b" }}>🌐 {u.ipAddress}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>
                      <span style={{
                        background: "#1a1a2e", border: "1px solid #27272a",
                        borderRadius: 6, padding: "2px 8px", color: "#f59e0b",
                        fontFamily: "monospace", letterSpacing: 1,
                      }}>{u.key}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#71717a", whiteSpace: "nowrap" }}>
                      {formatDate(u.activatedAt)}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#71717a", whiteSpace: "nowrap" }}>
                      {timeAgo(u.lastSeenAt)}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {u.blocked ? (
                        <div>
                          <span style={{
                            background: "#1f0000", border: "1px solid #dc2626",
                            color: "#ef4444", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                          }}>🚫 Blocked</span>
                          {u.blockedReason && (
                            <div style={{ color: "#71717a", fontSize: 11, marginTop: 3 }}>{u.blockedReason}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{
                          background: "#052e16", border: "1px solid #16a34a",
                          color: "#4ade80", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                        }}>✅ Active</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {u.blocked ? (
                          <button
                            onClick={() => unblockUser(u.id)}
                            style={{
                              padding: "5px 12px", background: "#16a34a", color: "#fff",
                              border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
                            }}
                          >Unblock</button>
                        ) : (
                          <button
                            onClick={() => setBlockingId(u.id)}
                            style={{
                              padding: "5px 12px", background: "#dc2626", color: "#fff",
                              border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
                            }}
                          >Block</button>
                        )}
                        <button
                          onClick={() => deleteUser(u.id, u.name)}
                          style={{
                            padding: "5px 10px", background: "#1a1a2e", color: "#71717a",
                            border: "1px solid #27272a", borderRadius: 6, cursor: "pointer", fontSize: 12,
                          }}
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ color: "#3f3f46", fontSize: 11, textAlign: "center", marginTop: 20 }}>
          SAI Rolotech Smart Engines — Admin Panel • Auto-refresh har 30 seconds
        </p>
      </div>
    </div>
  );
}
