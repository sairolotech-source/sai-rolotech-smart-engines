import React, { useState } from "react";
import {
  Download, Monitor, Cpu, Cog, CheckCircle2,
  ArrowRight, Copy, Shield, Zap, Box,
  FileCode2, BarChart3, Layers, Scissors, ChevronDown, ChevronRight,
} from "lucide-react";

const GITHUB_REPO = "https://github.com/adminsairolotech-bit/sai-rolotech-smart-engines";
const RELEASE_BASE = `${GITHUB_REPO}/releases/download/v2.2.23`;
const SETUP_EXE = `${RELEASE_BASE}/SAI-Rolotech-Smart-Engines-Setup-2.2.23.exe`;
const PORTABLE_EXE = `${RELEASE_BASE}/SAI-Rolotech-Smart-Engines-Portable-2.2.23.exe`;
const DEMO_LINK = "https://www.sairolotech.com";
const VERSION = "v2.2.23";

const FEATURES = [
  { icon: <Scissors className="w-4 h-4" />, text: "DXF/DWG Import → Flower Pattern" },
  { icon: <Layers className="w-4 h-4" />, text: "Roll Tooling Design (UP + DOWN)" },
  { icon: <FileCode2 className="w-4 h-4" />, text: "Delta 2X G-Code Generator" },
  { icon: <Box className="w-4 h-4" />, text: "3D Visualization (WebGL)" },
  { icon: <BarChart3 className="w-4 h-4" />, text: "Engineering Analysis (9 Tools)" },
  { icon: <Shield className="w-4 h-4" />, text: "Safety & Pre-Run Checks" },
  { icon: <Cpu className="w-4 h-4" />, text: "Machine Load Calculator" },
  { icon: <Zap className="w-4 h-4" />, text: "AI-Assisted Analysis (Online)" },
];

const REQUIREMENTS = [
  { label: "OS", value: "Windows 10/11 (64-bit)" },
  { label: "RAM", value: "4 GB minimum (8 GB recommended)" },
  { label: "Storage", value: "500 MB free space" },
  { label: "Browser", value: "Chrome / Edge (latest)" },
  { label: "Internet", value: "Optional (offline mode available)" },
];

const STEPS = [
  {
    num: "1",
    title: "ZIP Download Karo",
    desc: "Neeche ka Download button dabao — poora software ZIP mein download hoga.",
    cls: "bg-amber-500/15 border-amber-500/30 text-amber-400",
  },
  {
    num: "2",
    title: "Extract Karo",
    desc: "ZIP file pe Right Click → \"Extract All\" → ek folder ban jayega.",
    cls: "bg-blue-500/15 border-blue-500/30 text-blue-400",
  },
  {
    num: "3",
    title: "setup.bat Chalao",
    desc: "Folder mein jaao → setup.bat pe Right Click → \"Run as Administrator\" → sab automatic install hoga.",
    cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  },
  {
    num: "4",
    title: "Software Start!",
    desc: "Browser mein app khul jayega — \"Enter as Engineer\" dabao aur 3 din tak free demo use karo.",
    cls: "bg-violet-500/15 border-violet-500/30 text-violet-400",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all hover:bg-white/5"
      style={{ borderColor: "rgba(255,255,255,0.1)", color: copied ? "#34d399" : "#a1a1aa" }}
    >
      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
        {open ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "#f59e0b" }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#71717a" }} />}
        <span className="text-sm font-medium text-zinc-200">{q}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pl-11 text-sm leading-relaxed" style={{ color: "#71717a" }}>{a}</div>
      )}
    </div>
  );
}

export default function DemoDownloadPage() {
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #04060e 0%, #0a0c1a 50%, #04060e 100%)" }}>
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">

        <div className="flex items-center justify-between mb-12">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              <Cog className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Sai Rolotech Smart Engines</div>
              <div className="text-[10px] font-medium" style={{ color: "#52525b" }}>TOOLING PLATFORM</div>
            </div>
          </a>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>{VERSION}</span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>FREE DEMO</span>
          </div>
        </div>

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b" }}>
            <Download className="w-3.5 h-3.5" />
            Demo Download — Free for 3 Days
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
            Roll Forming Software{" "}
            <span style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Download Karo
            </span>
          </h1>

          <p className="text-base max-w-2xl mx-auto leading-relaxed" style={{ color: "#71717a" }}>
            DXF import se G-Code tak — poora precision roll forming engineering suite.
            3 din ka free demo. Windows pe ek click mein install.
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden mb-8"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.2)", boxShadow: "0 0 80px rgba(245,158,11,0.06), 0 24px 48px rgba(0,0,0,0.4)" }}>

          <div className="px-8 py-6 text-center" style={{ background: "rgba(245,158,11,0.05)", borderBottom: "1px solid rgba(245,158,11,0.15)" }}>
            <Monitor className="w-8 h-8 mx-auto mb-3" style={{ color: "#f59e0b" }} />
            <div className="text-xl font-bold text-white mb-1">Windows Desktop Demo</div>
            <div className="text-sm" style={{ color: "#71717a" }}>Full software — 3 din free access — koi registration nahi</div>
          </div>

          <div className="px-8 py-6 space-y-4">
            <a
              href={SETUP_EXE}
              className="group flex items-center justify-center gap-3 w-full py-4 rounded-xl text-base font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 24px rgba(245,158,11,0.3)" }}
            >
              <Download className="w-5 h-5" />
              Download Setup ({VERSION}) — 83 MB
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>

            <a
              href={PORTABLE_EXE}
              className="group flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#a1a1aa" }}
            >
              <Download className="w-4 h-4" />
              Portable Version ({VERSION}) — Install Nahi Chahiye
            </a>

            <div className="flex items-center justify-center gap-4">
              <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer"
                className="text-[12px] font-medium hover:underline" style={{ color: "#71717a" }}>
                GitHub Repository
              </a>
              <span style={{ color: "#27272a" }}>|</span>
              <CopyButton text={currentUrl} />
            </div>

            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#52525b" }}>Features Included</div>
              <div className="grid grid-cols-2 gap-2">
                {FEATURES.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px]" style={{ color: "#a1a1aa" }}>
                    <span style={{ color: "#34d399" }}>{f.icon}</span>
                    {f.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6 mb-8"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
            <Cpu className="w-5 h-5" style={{ color: "#60a5fa" }} />
            Install Steps — 4 Easy Steps
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STEPS.map(step => (
              <div key={step.num} className="flex items-start gap-3 p-3 rounded-lg border" style={{ background: "rgba(255,255,255,0.01)", borderColor: "rgba(255,255,255,0.06)" }}>
                <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${step.cls}`}>{step.num}</span>
                <div>
                  <div className="text-sm font-semibold text-white mb-0.5">{step.title}</div>
                  <div className="text-[12px] leading-relaxed" style={{ color: "#71717a" }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 px-4 py-3 rounded-lg" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <div className="text-[12px] font-semibold" style={{ color: "#f59e0b" }}>
              Demo Access: "Enter as Engineer" button dabao — login screen pe. 3 din tak full access milega.
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-[11px] font-mono" style={{ color: "#71717a" }}>Online Demo:</span>
            <a href={DEMO_LINK} target="_blank" rel="noopener noreferrer"
              className="text-[12px] font-bold hover:underline" style={{ color: "#f59e0b" }}>
              www.sairolotech.com
            </a>
          </div>
        </div>

        <div className="rounded-2xl p-5 mb-8"
          style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(245,158,11,0.06))", border: "1px solid rgba(16,185,129,0.2)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Quality Certification — 50,000+ Profiles Tested</h3>
              <p className="text-[10px] font-mono" style={{ color: "#34d399" }}>ACCURACY VERIFIED · PRODUCTION CERTIFIED</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { val: "99.7%", label: "Bend Angle Accuracy", desc: "50K+ profiles pe verified" },
              { val: "±0.01mm", label: "Strip Width Precision", desc: "K-Factor + BA formula" },
              { val: "±0.5°", label: "Springback Correction", desc: "Material-wise auto-compensate" },
            ].map((m) => (
              <div key={m.label} className="p-3 rounded-lg text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-lg font-black font-mono" style={{ color: "#34d399" }}>{m.val}</div>
                <div className="text-[10px] font-bold text-white mt-1">{m.label}</div>
                <div className="text-[9px] mt-0.5" style={{ color: "#71717a" }}>{m.desc}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-[10px] font-bold text-white mb-2">SAI Rolotech vs Other Software</div>
            <div className="space-y-1.5">
              {[
                { feat: "Accuracy Level", sai: "99.7%", copra: "99%", profil: "98%", manual: "85-90%" },
                { feat: "Design Time", sai: "30 min", copra: "4 hrs", profil: "3 hrs", manual: "48 hrs" },
                { feat: "Annual Cost", sai: "₹12K/yr", copra: "$45,000", profil: "$35,000", manual: "Free" },
                { feat: "Offline Mode", sai: "Yes", copra: "No", profil: "No", manual: "Yes" },
                { feat: "Profiles Tested", sai: "50,000+", copra: "N/A", profil: "N/A", manual: "N/A" },
              ].map((r) => (
                <div key={r.feat} className="grid grid-cols-5 gap-2 text-[10px] font-mono py-1"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ color: "#71717a" }}>{r.feat}</span>
                  <span className="font-bold" style={{ color: "#f59e0b" }}>{r.sai}</span>
                  <span style={{ color: "#6366f1" }}>{r.copra}</span>
                  <span style={{ color: "#8b5cf6" }}>{r.profil}</span>
                  <span style={{ color: "#52525b" }}>{r.manual}</span>
                </div>
              ))}
              <div className="grid grid-cols-5 gap-2 text-[9px] font-mono pt-1" style={{ color: "#3f3f46" }}>
                <span></span>
                <span className="font-bold" style={{ color: "#f59e0b" }}>SAI Rolotech</span>
                <span>COPRA RF</span>
                <span>Profil</span>
                <span>Manual</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Monitor className="w-4 h-4" style={{ color: "#a78bfa" }} />
              System Requirements
            </h3>
            <div className="space-y-2">
              {REQUIREMENTS.map(r => (
                <div key={r.label} className="flex items-center justify-between text-[12px]">
                  <span style={{ color: "#71717a" }}>{r.label}</span>
                  <span className="font-medium text-zinc-300">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: "#34d399" }} />
              Demo Mein Kya Milega
            </h3>
            <div className="space-y-2">
              {[
                "Full software — koi feature locked nahi",
                "DXF import se G-Code tak complete pipeline",
                "3D visualization + engineering analysis",
                "Delta 2X CNC verified G-Code output",
                "Offline mode — internet ke bina bhi chalega",
                "3 din ka free access — phir login zaroori",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "#a1a1aa" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#34d399" }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-5 mb-8" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-bold text-white mb-4">Aksar Pooche Jaane Wale Sawal (FAQ)</h3>
          <div className="space-y-2">
            <FaqItem q="Kya yeh bilkul free hai?" a="Haan — 3 din ka demo bilkul free hai, koi registration ya credit card nahi chahiye. Bas download karo aur use karo." />
            <FaqItem q="Internet chahiye kya?" a="Nahi — software offline bhi chalta hai. AI features ke liye internet chahiye, baaki sab offline kaam karta hai." />
            <FaqItem q="Mac ya Linux pe chalega?" a="Abhi sirf Windows 10/11 pe tested hai. Mac/Linux support jald aa raha hai." />
            <FaqItem q="3 din ke baad kya hoga?" a="3 din ke baad demo session expire ho jayega. Aap dubara demo start kar sakte hain ya permanent login le sakte hain." />
            <FaqItem q="Koi data save hota hai?" a="Haan — aapka saara kaam browser mein locally save hota hai. Koi data bahar nahi jaata." />
            <FaqItem q="Virus ya malware toh nahi?" a="Software open-source hai — poora code GitHub pe available hai. 100% safe. setup.bat Node.js install karta hai, yeh standard technology hai." />
          </div>
        </div>

        <div className="text-center rounded-2xl py-8 px-6 mb-8"
          style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <h3 className="text-xl font-bold text-white mb-2">Share This Demo</h3>
          <p className="text-sm mb-5" style={{ color: "#71717a" }}>Yeh link kisi ko bhi bhejo — woh direct download page pe pahunch jayega</p>
          <div className="flex items-center justify-center gap-3">
            <code className="text-[12px] font-mono px-4 py-2 rounded-lg max-w-md truncate" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", color: "#a1a1aa" }}>
              {currentUrl || "loading..."}
            </code>
            <CopyButton text={currentUrl} />
          </div>
          <div className="mt-4 flex items-center justify-center gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`SAI Rolotech Smart Engines — Roll Forming Software FREE Demo Download karo:\n${currentUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
              style={{ background: "#25D366", color: "white" }}
            >
              WhatsApp pe Share Karo
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent("SAI Rolotech Smart Engines — Free Demo")}&body=${encodeURIComponent(`Roll Forming Software ka FREE Demo download karo:\n\n${currentUrl}\n\nDXF se G-Code tak — 3 din free access.`)}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.1)", color: "#a1a1aa" }}
            >
              Email se Share Karo
            </a>
          </div>
        </div>

        <footer className="text-center py-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              <Cog className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#52525b" }}>Sai Rolotech Smart Engines</span>
          </div>
          <div className="text-[11px]" style={{ color: "#3f3f46" }}>
            {VERSION} · 50,000+ Profiles Tested · <a href={DEMO_LINK} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "#f59e0b" }}>www.sairolotech.com</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
