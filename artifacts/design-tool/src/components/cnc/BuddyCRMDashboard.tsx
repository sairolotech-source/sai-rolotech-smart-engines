import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Bot, Users, MessageSquare, BarChart2, Phone, Star, Plus, Trash2,
  CheckCircle, Clock, XCircle, Zap, Send, RefreshCw, ChevronDown,
  ChevronUp, TrendingUp, Target, Eye, Edit2, Save, X, Bell,
  Sparkles, FileText, Filter, Search, ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = "new" | "contacted" | "qualified" | "demo" | "quoted" | "won" | "lost";
type LeadSource = "whatsapp" | "phone" | "walkin" | "referral" | "website" | "tradex" | "instagram" | "other";
type LeadProduct = "roll_machine" | "roll_tooling" | "spare_parts" | "service" | "cnc_turning" | "consulting" | "other";

interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  city: string;
  source: LeadSource;
  product: LeadProduct;
  status: LeadStatus;
  score: number;        // 1-100 AI score
  notes: string;
  requirement: string;
  budget: string;
  createdAt: string;
  lastContact: string;
  aiAnalysis?: string;
  followUpDate?: string;
  tags: string[];
}

interface AgentLog {
  id: string;
  agent: "buddy" | "scout" | "whatsapp" | "qualifier" | "analytics";
  message: string;
  time: string;
  type: "info" | "success" | "warn" | "action";
}

interface BuddyMessage {
  id: string;
  role: "user" | "buddy";
  content: string;
  time: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  new:       { label: "New",       color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/30",   icon: <Zap className="w-3 h-3" /> },
  contacted: { label: "Contacted", color: "text-cyan-400",   bg: "bg-cyan-500/15 border-cyan-500/30",   icon: <Phone className="w-3 h-3" /> },
  qualified: { label: "Qualified", color: "text-violet-400", bg: "bg-violet-500/15 border-violet-500/30",icon: <Star className="w-3 h-3" /> },
  demo:      { label: "Demo",      color: "text-amber-400",  bg: "bg-amber-500/15 border-amber-500/30", icon: <Eye className="w-3 h-3" /> },
  quoted:    { label: "Quoted",    color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/30",icon: <FileText className="w-3 h-3" /> },
  won:       { label: "Won ✓",     color: "text-emerald-400",bg: "bg-emerald-500/15 border-emerald-500/30",icon: <CheckCircle className="w-3 h-3" /> },
  lost:      { label: "Lost",      color: "text-red-400",    bg: "bg-red-500/15 border-red-500/30",     icon: <XCircle className="w-3 h-3" /> },
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp: "📱 WhatsApp", phone: "📞 Phone Call", walkin: "🚪 Walk-in",
  referral: "🤝 Referral", website: "🌐 Website", tradex: "🏭 Trade Show",
  instagram: "📸 Instagram", other: "🔹 Other",
};

const PRODUCT_LABELS: Record<LeadProduct, string> = {
  roll_machine: "Roll Forming Machine", roll_tooling: "Roll Tooling", spare_parts: "Spare Parts",
  service: "Service / AMC", cnc_turning: "CNC Turning", consulting: "Consulting", other: "Other",
};

const AGENT_CONFIG = {
  buddy:     { name: "BUDDY",     icon: "🤖", color: "#f59e0b", desc: "Main AI Coordinator" },
  scout:     { name: "Lead Scout",icon: "🔍", color: "#06b6d4", desc: "Leads dhundta hai" },
  whatsapp:  { name: "WA Bot",    icon: "📱", color: "#22c55e", desc: "WhatsApp messages bhejta hai" },
  qualifier: { name: "Qualifier", icon: "⭐", color: "#a78bfa", desc: "Leads qualify karta hai" },
  analytics: { name: "Analytics", icon: "📊", color: "#f97316", desc: "Data analyze karta hai" },
};

const WA_TEMPLATES: { label: string; text: string }[] = [
  {
    label: "First Contact",
    text: "Assalam-o-Alaikum {name} ji,\n\nHum Sai Rolotech se bol rahe hain. Aapne roll forming machine ke baare mein enquiry ki thi.\n\nKya aap thodi baat kar sakte hain? Hum aapki requirement ke according best solution de sakte hain.\n\n*Sai Rolotech Smart Engines* 🏭",
  },
  {
    label: "Follow Up",
    text: "Assalam-o-Alaikum {name} ji,\n\nKya haal hain? Humne pehle baat ki thi roll forming machine ke baare mein.\n\nKya abhi bhi requirement hai? Hum aapke liye special offer de sakte hain.\n\nPlease reply karein 🙏",
  },
  {
    label: "Quote Sent",
    text: "Assalam-o-Alaikum {name} ji,\n\nAapka quotation bhej diya gaya hai. Please check karein.\n\nAgar koi sawaal ho to hum haazir hain.\n\n*Sai Rolotech* ✅",
  },
  {
    label: "Demo Invite",
    text: "Assalam-o-Alaikum {name} ji,\n\nAapko hamare workshop mein machine demo dekhne ke liye invite karna chahte hain.\n\n📍 Location: Hum aapko batayenge\n📅 Date: Aap ki convenience se\n\nPlease confirm karein 🏭",
  },
];

function genId() { return Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); }
function today() { return new Date().toISOString().slice(0, 10); }
function fmt(d: string) { return d ? new Date(d).toLocaleDateString("en-IN") : "—"; }

function scoreColor(s: number) {
  if (s >= 75) return "text-emerald-400";
  if (s >= 50) return "text-amber-400";
  if (s >= 25) return "text-orange-400";
  return "text-red-400";
}

const DEMO_LEADS: Lead[] = [
  { id: genId(), name: "Ramesh Patel", company: "Patel Steel Industries", phone: "9876543210", city: "Surat", source: "whatsapp", product: "roll_machine", status: "qualified", score: 82, notes: "C-channel machine chahiye 20x20 profile", requirement: "C-Channel 20x20 Roll Forming Machine", budget: "25-35 Lakh", createdAt: "2026-03-10", lastContact: "2026-03-20", tags: ["hot", "urgent"], aiAnalysis: "High intent buyer — budget clear hai, technical requirement specific hai." },
  { id: genId(), name: "Suresh Kumar", company: "Kumar Fabricators", phone: "9812345678", city: "Ahmedabad", source: "phone", product: "roll_tooling", status: "contacted", score: 58, notes: "Roll tooling set chahiye C-channel ke liye", requirement: "Roll Tooling Set 12 stations", budget: "5-8 Lakh", createdAt: "2026-03-15", lastContact: "2026-03-19", tags: ["followup"], aiAnalysis: "Medium intent — tooling ke liye sahi hai lekin machine already hai." },
  { id: genId(), name: "Ajay Singh", company: "Singh Metals Pvt Ltd", phone: "9988776655", city: "Delhi", source: "tradex", product: "roll_machine", status: "demo", score: 91, notes: "Trade show mein milgaye — very interested", requirement: "Full automatic roll forming line", budget: "50+ Lakh", createdAt: "2026-03-12", lastContact: "2026-03-21", tags: ["VIP", "hot", "demo done"], aiAnalysis: "Very high intent — trade show se aye hain, demo request kar chuke hain. Priority lead." },
  { id: genId(), name: "Meena Shah", company: "Shah Industries", phone: "9765432100", city: "Rajkot", source: "referral", product: "spare_parts", status: "new", score: 35, notes: "Referral se aaya — spare parts chahiye", requirement: "Spare parts for existing machine", budget: "1-2 Lakh", createdAt: "2026-03-21", lastContact: "2026-03-21", tags: [], aiAnalysis: "Low-medium intent — spare parts only, small ticket." },
  { id: genId(), name: "Vishal Gupta", company: "Gupta Engineering", phone: "9654321089", city: "Pune", source: "instagram", product: "cnc_turning", status: "won", score: 95, notes: "Deal close ho gaya — 2 roll sets order", requirement: "CNC Roll Turning 2 sets", budget: "12 Lakh", createdAt: "2026-03-01", lastContact: "2026-03-18", tags: ["won", "paid"], aiAnalysis: "Deal won! Repeat customer potential high." },
];

// ─── Lead Form ────────────────────────────────────────────────────────────────

function LeadForm({ lead, onSave, onClose }: {
  lead: Partial<Lead>; onSave: (l: Lead) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Lead>>({ status: "new", source: "whatsapp", product: "roll_machine", score: 50, tags: [], ...lead });
  const s = (k: keyof Lead) => (v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.name || !form.phone) return;
    onSave({
      id: form.id || genId(),
      name: form.name || "", company: form.company || "", phone: form.phone || "",
      city: form.city || "", source: form.source || "other", product: form.product || "other",
      status: form.status || "new", score: form.score || 50, notes: form.notes || "",
      requirement: form.requirement || "", budget: form.budget || "",
      createdAt: form.createdAt || today(), lastContact: today(),
      tags: form.tags || [], aiAnalysis: form.aiAnalysis,
    });
  };

  const inp = "bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-200 focus:border-blue-500 focus:outline-none w-full";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-blue-400" />
          <span className="text-[12px] font-bold text-zinc-200">{form.id ? "Lead Edit" : "Naya Lead Add Karo"}</span>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-2">
          {[
            { label: "Naam*", key: "name", type: "text", placeholder: "Lead ka naam" },
            { label: "Company", key: "company", type: "text", placeholder: "Company naam" },
            { label: "Phone*", key: "phone", type: "tel", placeholder: "WhatsApp number" },
            { label: "City", key: "city", type: "text", placeholder: "Shahar" },
            { label: "Requirement", key: "requirement", type: "text", placeholder: "Kya chahiye?" },
            { label: "Budget", key: "budget", type: "text", placeholder: "Budget range" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider">{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} className={inp}
                value={(form[f.key as keyof Lead] as string) || ""}
                onChange={e => s(f.key as keyof Lead)(e.target.value)} />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider">Source</label>
              <select className={inp} value={form.source} onChange={e => s("source")(e.target.value as LeadSource)}>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider">Product</label>
              <select className={inp} value={form.product} onChange={e => s("product")(e.target.value as LeadProduct)}>
                {Object.entries(PRODUCT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider">Status</label>
              <select className={inp} value={form.status} onChange={e => s("status")(e.target.value as LeadStatus)}>
                {Object.keys(STATUS_CONFIG).map(k => <option key={k} value={k}>{STATUS_CONFIG[k as LeadStatus].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 uppercase tracking-wider">AI Score (1-100)</label>
              <input type="number" min={1} max={100} className={inp} value={form.score}
                onChange={e => s("score")(parseInt(e.target.value) || 50)} />
            </div>
          </div>

          <div>
            <label className="text-[9px] text-zinc-500 uppercase tracking-wider">Notes</label>
            <textarea className={inp + " h-16 resize-none"} placeholder="Notes..."
              value={form.notes || ""} onChange={e => s("notes")(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 py-1.5 rounded border border-zinc-700 text-zinc-400 text-[11px] hover:bg-zinc-800">Cancel</button>
          <button onClick={handleSave} disabled={!form.name || !form.phone}
            className="flex-1 py-1.5 rounded bg-blue-500 text-white text-[11px] font-bold hover:bg-blue-600 disabled:opacity-40 flex items-center justify-center gap-1">
            <Save className="w-3 h-3" /> Save Lead
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WA Message Modal ─────────────────────────────────────────────────────────

function WAMessageModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [customText, setCustomText] = useState("");

  const template = WA_TEMPLATES[selectedTemplate];
  const message = (customText || template.text).replace("{name}", lead.name);
  const waUrl = `https://wa.me/91${lead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📱</span>
          <span className="text-[12px] font-bold text-zinc-200">WhatsApp — {lead.name}</span>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex gap-1 flex-wrap mb-2">
          {WA_TEMPLATES.map((t, i) => (
            <button key={i} onClick={() => { setSelectedTemplate(i); setCustomText(""); }}
              className={`px-2 py-0.5 rounded text-[9px] border transition-all ${i === selectedTemplate ? "bg-green-500/20 border-green-500/40 text-green-300" : "bg-zinc-800/40 border-zinc-700/40 text-zinc-500"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-[11px] text-zinc-200 h-36 resize-none focus:border-green-500 focus:outline-none"
          value={customText || template.text.replace("{name}", lead.name)}
          onChange={e => setCustomText(e.target.value)}
        />

        <div className="mt-2 text-[9px] text-zinc-600 bg-zinc-800/40 rounded px-2 py-1">
          📱 Number: +91-{lead.phone} &nbsp;|&nbsp; Bina API ke directly WhatsApp Web khulega
        </div>

        <a href={waUrl} target="_blank" rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded bg-green-600 hover:bg-green-500 text-white text-[11px] font-bold transition-all">
          <ExternalLink className="w-3.5 h-3.5" />
          WhatsApp pe Bhejo — {lead.name}
        </a>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const STORAGE_KEY = "sai_buddy_crm_leads";
const LOG_KEY = "sai_buddy_crm_logs";

export function BuddyCRMDashboard() {
  const [leads, setLeads] = useState<Lead[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "") || DEMO_LEADS; }
    catch { return DEMO_LEADS; }
  });

  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([
    { id: genId(), agent: "buddy", message: "Assalam-o-Alaikum! Main BUDDY hoon — aapka AI CRM coordinator. Sab agents mujhe report karte hain.", time: now(), type: "info" },
    { id: genId(), agent: "scout", message: `${DEMO_LEADS.length} leads load ho gaye — BUDDY ko report kiya.`, time: now(), type: "success" },
    { id: genId(), agent: "analytics", message: `Won leads: 1 | Hot leads: 2 | Follow-up pending: 3`, time: now(), type: "info" },
  ]);

  const [buddyMessages, setBuddyMessages] = useState<BuddyMessage[]>([
    { id: genId(), role: "buddy", content: `**Assalam-o-Alaikum!** Main **BUDDY** hoon — aapka AI CRM assistant. 🤖\n\nMain sabhi agents ko coordinate karta hoon:\n• 🔍 **Lead Scout** — naye leads track karta hai\n• 📱 **WA Bot** — WhatsApp messages bhejta hai\n• ⭐ **Qualifier** — leads score karta hai\n• 📊 **Analytics** — data analyze karta hai\n\nAap mujhse kuch bhi pucho — leads ka status, best prospects, follow-up kab karna hai — sab bata dunga!`, time: now() },
  ]);

  const [buddyInput, setBuddyInput] = useState("");
  const [activeTab, setActiveTab] = useState<"leads" | "buddy" | "agents" | "analytics" | "whatsapp">("buddy");
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [waLead, setWaLead] = useState<Lead | null>(null);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [searchQ, setSearchQ] = useState("");
  const [buddyLoading, setBuddyLoading] = useState(false);
  const [agentsActive, setAgentsActive] = useState(false);
  const buddyChatRef = useRef<HTMLDivElement>(null);

  // Persist leads
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  // Scroll buddy chat to bottom
  useEffect(() => {
    if (buddyChatRef.current) buddyChatRef.current.scrollTop = buddyChatRef.current.scrollHeight;
  }, [buddyMessages]);

  const addLog = useCallback((agent: AgentLog["agent"], message: string, type: AgentLog["type"] = "info") => {
    setAgentLogs(prev => [...prev.slice(-49), { id: genId(), agent, message, time: now(), type }]);
  }, []);

  // Analytics
  const analytics = useMemo(() => {
    const total = leads.length;
    const byStatus = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
      acc[s as LeadStatus] = leads.filter(l => l.status === s).length;
      return acc;
    }, {} as Record<LeadStatus, number>);
    const bySource = Object.keys(SOURCE_LABELS).reduce((acc, s) => {
      acc[s as LeadSource] = leads.filter(l => l.source === s).length;
      return acc;
    }, {} as Record<LeadSource, number>);
    const byProduct = Object.keys(PRODUCT_LABELS).reduce((acc, p) => {
      acc[p as LeadProduct] = leads.filter(l => l.product === p).length;
      return acc;
    }, {} as Record<LeadProduct, number>);
    const hot = leads.filter(l => l.score >= 75 && !["won", "lost"].includes(l.status)).length;
    const wonCount = byStatus["won"];
    const convRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;
    const avgScore = total > 0 ? Math.round(leads.reduce((a, l) => a + l.score, 0) / total) : 0;
    return { total, byStatus, bySource, byProduct, hot, wonCount, convRate, avgScore };
  }, [leads]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads
      .filter(l => statusFilter === "all" || l.status === statusFilter)
      .filter(l => {
        if (!searchQ) return true;
        const q = searchQ.toLowerCase();
        return l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.phone.includes(q) || l.city.toLowerCase().includes(q);
      })
      .sort((a, b) => b.score - a.score);
  }, [leads, statusFilter, searchQ]);

  // Save / Add lead
  const saveLead = useCallback((lead: Lead) => {
    setLeads(prev => {
      const idx = prev.findIndex(l => l.id === lead.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = lead; return n; }
      return [...prev, lead];
    });
    addLog("scout", `Lead ${lead.id === editLead?.id ? "update" : "add"} hua: ${lead.name} — Score: ${lead.score}`, "success");
    addLog("qualifier", `${lead.name} qualify kiya — Score: ${lead.score}/100`, "info");
    setShowForm(false);
    setEditLead(null);
  }, [editLead, addLog]);

  const deleteLead = useCallback((id: string) => {
    const lead = leads.find(l => l.id === id);
    setLeads(prev => prev.filter(l => l.id !== id));
    addLog("scout", `Lead delete hua: ${lead?.name}`, "warn");
  }, [leads, addLog]);

  const updateStatus = useCallback((id: string, status: LeadStatus) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status, lastContact: today() } : l));
    const lead = leads.find(l => l.id === id);
    addLog("buddy", `${lead?.name} ka status update: ${STATUS_CONFIG[status].label}`, "success");
  }, [leads, addLog]);

  // BUDDY AI chat
  const sendToBuddy = useCallback(async () => {
    if (!buddyInput.trim() || buddyLoading) return;
    const userMsg = buddyInput.trim();
    setBuddyInput("");
    setBuddyMessages(prev => [...prev, { id: genId(), role: "user", content: userMsg, time: now() }]);
    setBuddyLoading(true);
    addLog("buddy", `User ne pucha: "${userMsg.slice(0, 40)}..."`, "info");

    // Generate BUDDY's response based on CRM data
    await new Promise(r => setTimeout(r, 800));

    const q = userMsg.toLowerCase();
    let reply = "";

    // Context-aware responses
    if (q.includes("hot") || q.includes("best") || q.includes("top") || q.includes("priority")) {
      const hot = leads.filter(l => l.score >= 75 && !["won","lost"].includes(l.status)).sort((a,b) => b.score-a.score);
      reply = `🔥 **Top Priority Leads (Score ≥75):**\n\n${hot.length > 0 ? hot.map((l,i) => `${i+1}. **${l.name}** (${l.company}) — Score: **${l.score}/100**\n   📍 ${l.city} | 📱 ${l.phone} | ${STATUS_CONFIG[l.status].label}\n   💬 ${l.requirement || l.notes}`).join("\n\n") : "Abhi koi hot lead nahi hai."}\n\n📊 Kul ${hot.length} hot leads hain.`;
    } else if (q.includes("follow") || q.includes("contact") || q.includes("call")) {
      const pending = leads.filter(l => ["new","contacted","qualified"].includes(l.status)).sort((a,b) => b.score-a.score);
      reply = `📞 **Follow-up Pending (${pending.length} leads):**\n\n${pending.slice(0,5).map((l,i) => `${i+1}. **${l.name}** — ${l.phone}\n   Status: ${STATUS_CONFIG[l.status].label} | Score: ${l.score}/100\n   ${l.requirement || l.notes}`).join("\n\n")}\n\n💡 **BUDDY Suggestion:** Pehle high score wale leads ko call karo!`;
    } else if (q.includes("report") || q.includes("summary") || q.includes("kitna") || q.includes("total")) {
      reply = `📊 **BUDDY FULL REPORT:**\n\n**Lead Summary:**\n• Kul leads: **${analytics.total}**\n• Hot leads: **${analytics.hot}** 🔥\n• Won deals: **${analytics.wonCount}** ✅\n• Conversion rate: **${analytics.convRate}%**\n• Average score: **${analytics.avgScore}/100**\n\n**Status Breakdown:**\n${Object.entries(analytics.byStatus).filter(([,c])=>c>0).map(([s,c])=>`• ${STATUS_CONFIG[s as LeadStatus].label}: **${c}**`).join("\n")}\n\n**Top Source:**\n${Object.entries(analytics.bySource).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([s,c])=>`• ${SOURCE_LABELS[s as LeadSource]}: **${c}**`).join("\n")}\n\n📢 Sabhi agents se data collect karke yeh report tayyar ki.`;
    } else if (q.includes("whatsapp") || q.includes("message") || q.includes("bhejo") || q.includes("send")) {
      const candidates = leads.filter(l => ["new","contacted","qualified"].includes(l.status)).slice(0,3);
      reply = `📱 **WA Bot Report:**\n\n${candidates.length} leads ko WhatsApp message bheja ja sakta hai:\n\n${candidates.map(l=>`• **${l.name}** (+91-${l.phone})\n  Status: ${STATUS_CONFIG[l.status].label} | ${l.city}`).join("\n\n")}\n\n💡 **BUDDY Suggestion:** Leads tab mein jaao → WhatsApp icon click karo → Ready-made template se message bhejo!\n\n⚡ Yeh bina API ke kaam karta hai — directly WhatsApp Web khulta hai!`;
    } else if (q.includes("won") || q.includes("deal") || q.includes("close")) {
      const won = leads.filter(l => l.status === "won");
      reply = `🎉 **Won Deals Report:**\n\n${won.length > 0 ? won.map((l,i)=>`${i+1}. **${l.name}** (${l.company})\n   Budget: ${l.budget || "N/A"} | Product: ${PRODUCT_LABELS[l.product]}\n   📍 ${l.city}`).join("\n\n") : "Abhi koi deal close nahi hua."}\n\n📈 Total conversion rate: **${analytics.convRate}%**`;
    } else if (q.includes("source") || q.includes("kahan se") || q.includes("inquiry")) {
      reply = `🔍 **Lead Scout Report — Sources:**\n\n${Object.entries(analytics.bySource).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1]).map(([s,c])=>`${SOURCE_LABELS[s as LeadSource]}: **${c} leads**`).join("\n")}\n\n💡 **BUDDY Insight:** ${Object.entries(analytics.bySource).sort((a,b)=>b[1]-a[1])[0]?.[0] === "whatsapp" ? "WhatsApp se sabse zyada leads aa rahi hain!" : "Top source ko aur boost karo!"}`;
    } else if (q.includes("budget") || q.includes("paisa") || q.includes("amount")) {
      const qualified = leads.filter(l => !["lost"].includes(l.status) && l.budget);
      reply = `💰 **Budget Analysis:**\n\n${qualified.map(l=>`• **${l.name}** — Budget: ${l.budget || "N/A"} | Score: ${l.score}/100`).join("\n")}\n\n📊 High value leads concentrate karo — ${leads.filter(l=>l.score>=75).length} hot leads available hain.`;
    } else {
      // Generic response
      reply = `🤖 **BUDDY yahan hai!**\n\nMain in agents ko coordinate kar raha hoon:\n• 🔍 **Lead Scout**: ${analytics.total} leads track kar raha hai\n• ⭐ **Qualifier**: Avg score **${analytics.avgScore}/100**\n• 📊 **Analytics**: ${analytics.hot} hot leads identified\n• 📱 **WA Bot**: ${leads.filter(l=>["new","contacted"].includes(l.status)).length} leads ko message bhejne ki zaroorat hai\n\n💡 Mujhse yeh pucho:\n• "Best leads kaun hain?"\n• "Follow-up kab karna hai?"\n• "Kahan se inquiry aa rahi hai?"\n• "Full report do"\n• "WhatsApp kisko bhejein?"`;
    }

    setBuddyMessages(prev => [...prev, { id: genId(), role: "buddy", content: reply, time: now() }]);
    setBuddyLoading(false);
    addLog("buddy", "Response generate kiya", "success");
  }, [buddyInput, buddyLoading, leads, analytics, addLog]);

  // Run all agents scan
  const runAllAgents = useCallback(() => {
    setAgentsActive(true);
    addLog("buddy", "Sabhi agents ko activate kiya — scan shuru...", "info");
    setTimeout(() => addLog("scout", `${leads.length} leads scan kiye — ${analytics.hot} hot identified`, "success"), 500);
    setTimeout(() => addLog("qualifier", `Scoring complete — Avg: ${analytics.avgScore}/100`, "success"), 1000);
    setTimeout(() => addLog("whatsapp", `${leads.filter(l=>["new","contacted"].includes(l.status)).length} leads WA message ke liye ready`, "action"), 1500);
    setTimeout(() => addLog("analytics", `Report ready — Conversion: ${analytics.convRate}% | Won: ${analytics.wonCount}`, "info"), 2000);
    setTimeout(() => { addLog("buddy", "Sabhi agents ne report di — CRM up to date!", "success"); setAgentsActive(false); }, 2500);
  }, [leads, analytics, addLog]);

  // ── Render ──
  const TABS = [
    { id: "buddy",     icon: "🤖", label: "BUDDY" },
    { id: "leads",     icon: "👥", label: `Leads (${leads.length})` },
    { id: "agents",    icon: "⚡", label: "Agents" },
    { id: "analytics", icon: "📊", label: "Analytics" },
    { id: "whatsapp",  icon: "📱", label: "WhatsApp" },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-900/50 shrink-0">
        <span className="text-lg leading-none">🤖</span>
        <span className="text-sm font-black text-amber-400">BUDDY CRM</span>
        <span className="text-[9px] text-zinc-500">AI-Powered Customer Relations</span>
        <div className="flex items-center gap-1 ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[8px] text-emerald-400">BUDDY Active</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Quick stats */}
          <span className="text-[9px] bg-zinc-800 rounded px-2 py-0.5 text-zinc-400">{analytics.total} Leads</span>
          <span className="text-[9px] bg-amber-500/15 border border-amber-500/30 rounded px-2 py-0.5 text-amber-400">{analytics.hot} Hot 🔥</span>
          <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/30 rounded px-2 py-0.5 text-emerald-400">{analytics.wonCount} Won ✅</span>
          <button onClick={runAllAgents} disabled={agentsActive}
            className="flex items-center gap-1 px-2 py-1 rounded border bg-violet-500/15 border-violet-500/40 text-violet-300 text-[9px] font-bold hover:bg-violet-500/25 transition-all disabled:opacity-50">
            {agentsActive ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Run All Agents
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-zinc-800/60 bg-zinc-900/30 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
              activeTab === t.id
                ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
            }`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">

        {/* ── BUDDY CHAT ── */}
        {activeTab === "buddy" && (
          <div className="flex flex-col h-full">
            <div ref={buddyChatRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {buddyMessages.map(msg => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "buddy" && <span className="text-xl shrink-0 mt-0.5">🤖</span>}
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[11px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-500/20 border border-blue-500/30 text-blue-100"
                      : "bg-amber-500/10 border border-amber-500/20 text-zinc-200"
                  }`}>
                    {msg.content.split("\n").map((line, i) => {
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <div key={i} className={line === "" ? "h-2" : ""}>
                          {parts.map((part, j) =>
                            part.startsWith("**") && part.endsWith("**")
                              ? <strong key={j} className={msg.role === "buddy" ? "text-amber-300" : "text-blue-200"}>{part.slice(2, -2)}</strong>
                              : <span key={j}>{part}</span>
                          )}
                        </div>
                      );
                    })}
                    <div className="text-[8px] text-zinc-600 mt-1 text-right">{msg.time}</div>
                  </div>
                  {msg.role === "user" && <span className="text-xl shrink-0 mt-0.5">👤</span>}
                </div>
              ))}
              {buddyLoading && (
                <div className="flex gap-2">
                  <span className="text-xl">🤖</span>
                  <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                    BUDDY soch raha hai... <RefreshCw className="w-3 h-3 inline animate-spin ml-1" />
                  </div>
                </div>
              )}
            </div>
            {/* Quick prompts */}
            <div className="flex gap-1 px-3 py-1 overflow-x-auto border-t border-zinc-800/40 shrink-0">
              {["Best leads kaun hain?", "Full report do", "Follow-up list", "Kahan se inquiry?", "Won deals"].map(q => (
                <button key={q} onClick={() => { setBuddyInput(q); }}
                  className="shrink-0 px-2 py-0.5 rounded border border-zinc-700/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 text-[9px] whitespace-nowrap transition-all">
                  {q}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 p-3 border-t border-zinc-800/40 shrink-0">
              <input value={buddyInput} onChange={e => setBuddyInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendToBuddy()}
                placeholder="BUDDY se kuch bhi pucho... (Enter dabao)"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-[11px] text-zinc-200 focus:border-amber-500 focus:outline-none" />
              <button onClick={sendToBuddy} disabled={!buddyInput.trim() || buddyLoading}
                className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 transition-all">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── LEADS ── */}
        {activeTab === "leads" && (
          <div className="flex flex-col h-full">
            {/* Lead controls */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/40 shrink-0 flex-wrap gap-y-1">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1.5 text-zinc-600" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search..."
                  className="pl-6 pr-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-200 w-36 focus:outline-none focus:border-blue-500" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as LeadStatus | "all")}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-zinc-300 focus:outline-none">
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <span className="text-[9px] text-zinc-600">{filteredLeads.length} results</span>
              <button onClick={() => { setEditLead(null); setShowForm(true); }}
                className="ml-auto flex items-center gap-1 px-2 py-1 rounded border bg-blue-500/15 border-blue-500/40 text-blue-300 text-[10px] font-bold hover:bg-blue-500/25">
                <Plus className="w-3 h-3" /> Add Lead
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredLeads.map(lead => {
                const sc = STATUS_CONFIG[lead.status];
                return (
                  <div key={lead.id} className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-2.5 hover:border-zinc-700/60 transition-all">
                    <div className="flex items-start gap-2">
                      {/* Score badge */}
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700/50 flex flex-col items-center justify-center">
                        <span className={`text-[13px] font-black ${scoreColor(lead.score)}`}>{lead.score}</span>
                        <span className="text-[7px] text-zinc-600">score</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-zinc-200">{lead.name}</span>
                          <span className="text-[9px] text-zinc-500">{lead.company}</span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded border ${sc.bg} ${sc.color} font-bold flex items-center gap-0.5`}>
                            {sc.icon} {sc.label}
                          </span>
                          {lead.tags.map(tag => (
                            <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/40 text-zinc-500">#{tag}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[9px] text-zinc-500">📱 {lead.phone}</span>
                          <span className="text-[9px] text-zinc-500">📍 {lead.city}</span>
                          <span className="text-[9px] text-zinc-600">{SOURCE_LABELS[lead.source]}</span>
                          <span className="text-[9px] text-zinc-600">{PRODUCT_LABELS[lead.product]}</span>
                        </div>
                        {lead.requirement && <div className="text-[9px] text-zinc-400 mt-0.5 truncate">{lead.requirement}</div>}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <select value={lead.status}
                          onChange={e => updateStatus(lead.id, e.target.value as LeadStatus)}
                          className="text-[9px] bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-zinc-400 focus:outline-none">
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <button onClick={() => setWaLead(lead)} title="WhatsApp"
                          className="p-1.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all">
                          <MessageSquare className="w-3 h-3" />
                        </button>
                        <button onClick={() => { setEditLead(lead); setShowForm(true); }} title="Edit"
                          className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => deleteLead(lead.id)} title="Delete"
                          className="p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {lead.aiAnalysis && (
                      <div className="mt-1.5 text-[8px] text-violet-400 bg-violet-500/8 border border-violet-500/15 rounded px-2 py-1">
                        🤖 BUDDY: {lead.aiAnalysis}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredLeads.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                  <Users className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-[11px]">Koi lead nahi mila</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AGENTS ── */}
        {activeTab === "agents" && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Agents grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 shrink-0">
              {Object.entries(AGENT_CONFIG).map(([key, ag]) => (
                <div key={key} className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-2.5 text-center">
                  <div className="text-2xl mb-1">{ag.icon}</div>
                  <div className="text-[10px] font-bold" style={{ color: ag.color }}>{ag.name}</div>
                  <div className="text-[8px] text-zinc-600 mt-0.5">{ag.desc}</div>
                  <div className="mt-1.5 flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[8px] text-emerald-400">Active</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Agent flow diagram */}
            <div className="mx-3 mb-2 p-2 bg-zinc-900/40 border border-zinc-800/40 rounded-xl text-center">
              <div className="text-[9px] text-zinc-500 mb-1">Agent Flow — Sabhi BUDDY ko Report Karte Hain</div>
              <div className="flex items-center justify-center gap-1 flex-wrap text-[9px]">
                <span className="bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded">🔍 Scout</span>
                <span className="text-zinc-600">→</span>
                <span className="bg-violet-500/15 border border-violet-500/30 text-violet-300 px-2 py-0.5 rounded">⭐ Qualifier</span>
                <span className="text-zinc-600">→</span>
                <span className="bg-green-500/15 border border-green-500/30 text-green-300 px-2 py-0.5 rounded">📱 WA Bot</span>
                <span className="text-zinc-600">→</span>
                <span className="bg-orange-500/15 border border-orange-500/30 text-orange-300 px-2 py-0.5 rounded">📊 Analytics</span>
                <span className="text-zinc-600">→</span>
                <span className="bg-amber-500/20 border border-amber-500/50 text-amber-300 px-3 py-0.5 rounded font-bold">🤖 BUDDY</span>
              </div>
            </div>

            {/* Activity log */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Live Activity Log</div>
              {[...agentLogs].reverse().map(log => {
                const ag = AGENT_CONFIG[log.agent];
                return (
                  <div key={log.id} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-[9px] border ${
                    log.type === "success" ? "bg-emerald-500/5 border-emerald-500/15" :
                    log.type === "warn" ? "bg-amber-500/5 border-amber-500/15" :
                    log.type === "action" ? "bg-blue-500/5 border-blue-500/15" :
                    "bg-zinc-900/30 border-zinc-800/30"}`}>
                    <span className="shrink-0 text-base leading-none">{ag.icon}</span>
                    <div className="flex-1">
                      <span style={{ color: ag.color }} className="font-bold">{ag.name}</span>
                      <span className="text-zinc-400 ml-1">{log.message}</span>
                    </div>
                    <span className="text-zinc-700 shrink-0">{log.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === "analytics" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Total Leads",    value: analytics.total,       unit: "",  icon: "👥", bgClass: "bg-blue-500/10 border-blue-500/20", valClass: "text-blue-300" },
                { label: "Hot Leads 🔥",   value: analytics.hot,         unit: "",  icon: "🔥", bgClass: "bg-amber-500/10 border-amber-500/20", valClass: "text-amber-300" },
                { label: "Won Deals",      value: analytics.wonCount,    unit: "",  icon: "✅", bgClass: "bg-green-500/10 border-green-500/20", valClass: "text-green-300" },
                { label: "Conversion",     value: analytics.convRate,    unit: "%", icon: "📈", bgClass: "bg-violet-500/10 border-violet-500/20", valClass: "text-violet-300" },
              ].map(k => (
                <div key={k.label} className={`rounded-xl border p-3 text-center ${k.bgClass}`}>
                  <div className="text-xl mb-0.5">{k.icon}</div>
                  <div className={`text-2xl font-black ${k.valClass}`}>{k.value}{k.unit}</div>
                  <div className="text-[9px] text-zinc-500">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Status breakdown */}
            <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-3">
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Status Breakdown</div>
              <div className="space-y-1.5">
                {Object.entries(analytics.byStatus).filter(([,c])=>c>0).map(([s, count]) => {
                  const sc = STATUS_CONFIG[s as LeadStatus];
                  const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className={`text-[9px] w-20 shrink-0 ${sc.color}`}>{sc.label}</span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-current transition-all" style={{ width: `${pct}%`, color: sc.color.replace("text-", "") }} />
                      </div>
                      <span className="text-[9px] text-zinc-400 w-8 text-right">{count}</span>
                      <span className="text-[8px] text-zinc-600 w-8">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Source breakdown */}
            <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-3">
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Source — Kahan se Inquiry Aayi</div>
              <div className="space-y-1.5">
                {Object.entries(analytics.bySource).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1]).map(([s, count]) => {
                  const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-400 w-28 shrink-0 truncate">{SOURCE_LABELS[s as LeadSource]}</span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-cyan-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[9px] text-zinc-400 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Product interest */}
            <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-3">
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Product Interest</div>
              <div className="space-y-1.5">
                {Object.entries(analytics.byProduct).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1]).map(([p, count]) => {
                  const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                  return (
                    <div key={p} className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-400 w-32 shrink-0 truncate">{PRODUCT_LABELS[p as LeadProduct]}</span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[9px] text-zinc-400 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top leads */}
            <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-3">
              <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">🏆 Top Leads by Score</div>
              {leads.filter(l=>!["won","lost"].includes(l.status)).sort((a,b)=>b.score-a.score).slice(0,5).map((l,i)=>(
                <div key={l.id} className="flex items-center gap-2 py-1 border-b border-zinc-800/30 last:border-0">
                  <span className="text-[9px] text-zinc-600 w-4">{i+1}.</span>
                  <span className={`text-[11px] font-black w-8 shrink-0 ${scoreColor(l.score)}`}>{l.score}</span>
                  <span className="text-[10px] text-zinc-300 font-bold">{l.name}</span>
                  <span className="text-[9px] text-zinc-500">{l.city}</span>
                  <span className={`ml-auto text-[8px] px-1.5 py-0.5 rounded border ${STATUS_CONFIG[l.status].bg} ${STATUS_CONFIG[l.status].color}`}>{STATUS_CONFIG[l.status].label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WHATSAPP ── */}
        {activeTab === "whatsapp" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📱</span>
                <span className="text-[11px] font-bold text-green-300">WA Bot — Bina Paid API ke WhatsApp</span>
              </div>
              <p className="text-[9px] text-zinc-400 leading-relaxed">
                WhatsApp Business API ki zaroorat nahi! Yeh wa.me links use karta hai —
                click karo, WhatsApp Web khulega, ready-made message hoga. Bilkul FREE! ✅
              </p>
            </div>

            {/* Quick send to all new leads */}
            <div className="text-[9px] text-zinc-500 uppercase tracking-widest">Leads — WhatsApp Bhejo</div>
            {leads.filter(l => ["new","contacted","qualified"].includes(l.status)).sort((a,b)=>b.score-a.score).map(lead => (
              <div key={lead.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800/40 bg-zinc-900/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold ${scoreColor(lead.score)}`}>{lead.score}</span>
                    <span className="text-[10px] font-bold text-zinc-200">{lead.name}</span>
                    <span className="text-[9px] text-zinc-500">{lead.city}</span>
                    <span className={`text-[8px] px-1.5 rounded border ${STATUS_CONFIG[lead.status].bg} ${STATUS_CONFIG[lead.status].color}`}>
                      {STATUS_CONFIG[lead.status].label}
                    </span>
                  </div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">📱 +91-{lead.phone}</div>
                </div>
                <button onClick={() => setWaLead(lead)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 text-[10px] font-bold hover:bg-green-500/25 transition-all shrink-0">
                  <MessageSquare className="w-3 h-3" /> WhatsApp
                </button>
              </div>
            ))}

            {/* Templates preview */}
            <div className="text-[9px] text-zinc-500 uppercase tracking-widest">Message Templates</div>
            {WA_TEMPLATES.map((t, i) => (
              <div key={i} className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-2.5">
                <div className="text-[9px] font-bold text-green-400 mb-1">{t.label}</div>
                <div className="text-[9px] text-zinc-400 leading-relaxed whitespace-pre-line">{t.text.replace("{name}", "[Lead Naam]")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <LeadForm
          lead={editLead || {}}
          onSave={saveLead}
          onClose={() => { setShowForm(false); setEditLead(null); }}
        />
      )}
      {waLead && (
        <WAMessageModal lead={waLead} onClose={() => setWaLead(null)} />
      )}
    </div>
  );
}
