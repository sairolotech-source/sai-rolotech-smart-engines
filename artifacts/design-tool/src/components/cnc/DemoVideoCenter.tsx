import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, ChevronLeft, ChevronRight, Settings, FileCode2, Flower,
  Wrench, Layers, Activity, Box, Bot, Cpu, Shield, Ruler, Database,
  BarChart3, Eye, Download, Zap, Monitor, Target, ArrowRight,
} from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

interface DemoScene {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  duration: number;
  render: React.ComponentType<{ progress?: number }>;
}

function ProgressBar({ label, value, max, color, delay }: { label: string; value: number; max: number; color: string; delay: number }) {
  return (
    <motion.div className="mb-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}>
      <div className="flex justify-between text-xs mb-1"><span className="text-zinc-400">{label}</span><span style={{ color }}>{value}%</span></div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${(value / max) * 100}%` }} transition={{ delay: delay + 0.3, duration: 1, ease }} />
      </div>
    </motion.div>
  );
}

function StepIndicator({ steps, activeStep }: { steps: string[]; activeStep: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <motion.div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${i <= activeStep ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-zinc-800 text-zinc-500"}`}
            animate={{ scale: i === activeStep ? 1.05 : 1 }} transition={{ duration: 0.3 }}>
            {i < activeStep ? "✓" : i + 1}. {s}
          </motion.div>
          {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-zinc-600" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function SceneSetup({ progress = 0 }: { progress?: number }) {
  const step = Math.min(Math.floor(progress / 25), 4);
  const stripWidthProgress = progress <= 50 ? 0 : Math.min((progress - 50) / 50, 1);
  const stripWidth = 247.3 * stripWidthProgress;
  const fields = [
    { label: "Profile Name", value: "C-Channel 100×50", delay: 0.5 },
    { label: "Material", value: "GI Steel (GP) 1.5mm", delay: 1 },
    { label: "Line Speed", value: "15 m/min", delay: 1.5 },
    { label: "Motor RPM", value: "1440", delay: 2 },
    { label: "Arbor Length", value: "250mm", delay: 2.5 },
  ];
  return (
    <div className="flex flex-col items-center w-full h-full p-8">
      <StepIndicator steps={["Profile", "Material", "Machine", "Save"]} activeStep={step} />
      <div className="flex-1 flex items-center gap-8 w-full max-w-4xl">
        <div className="flex-1 space-y-4">
          {fields.map((f, i) => (
            <motion.div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex justify-between items-center"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: f.delay, ease }}>
              <span className="text-zinc-400 text-sm">{f.label}</span>
              <motion.span className="text-white font-mono text-sm bg-zinc-800 px-3 py-1 rounded"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: f.delay + 0.5 }}>
                {f.value}
              </motion.span>
            </motion.div>
          ))}
        </div>
        <motion.div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 3, ease }}>
          <div className="text-orange-400 text-xs uppercase tracking-wider mb-4 font-bold">Live Preview</div>
          <svg viewBox="0 0 200 120" className="w-full">
            <motion.path d="M 30 100 L 30 30 L 170 30 L 170 100" fill="none" stroke="#f97316" strokeWidth="3"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 3.5, duration: 2 }} />
            <motion.text x="100" y="115" textAnchor="middle" fill="#71717a" fontSize="8" fontFamily="monospace"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 5 }}>100mm × 50mm × 1.5mm</motion.text>
          </svg>
        </motion.div>
      </div>
    </div>
  );
}

function SceneDXFImport() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <div className="flex gap-8 w-full max-w-4xl items-center">
        <div className="flex-1">
          <motion.div className="bg-zinc-900 border border-dashed border-orange-500/40 rounded-xl p-12 text-center"
            animate={{ borderColor: ["rgba(249,115,22,0.4)", "rgba(249,115,22,0.8)", "rgba(249,115,22,0.4)"] }}
            transition={{ duration: 2, repeat: Infinity }}>
            <Download className="w-16 h-16 text-orange-400 mx-auto mb-4" />
            <div className="text-lg font-bold text-white mb-2">DXF / DWG File Drop</div>
            <div className="text-sm text-zinc-400">AutoCAD drawing import</div>
          </motion.div>
          <motion.div className="mt-4 grid grid-cols-3 gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>
            {["LINE", "ARC", "LWPOLYLINE"].map((e, i) => (
              <motion.div key={e} className="bg-zinc-800 text-center py-2 rounded text-xs text-orange-400 font-mono"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.5 + i * 0.2 }}>
                {e} ✓
              </motion.div>
            ))}
          </motion.div>
        </div>
        <motion.div className="text-6xl text-orange-400" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>→</motion.div>
        <div className="flex-1">
          <motion.div className="bg-zinc-900 border border-green-500/30 rounded-xl p-6" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 3.5 }}>
            <div className="text-green-400 font-bold text-sm mb-4">✓ Profile Extracted</div>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between"><span className="text-zinc-400">Segments:</span><span className="text-white">12</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Bends:</span><span className="text-white">4</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Strip Width:</span><span className="text-orange-400">{stripWidth.toFixed(1)}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Accuracy:</span><span className="text-green-400">99.7%</span></div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function SceneFlower() {
  const angles = [0, 15, 30, 45, 60, 75, 85, 90];
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-5xl">
        <svg viewBox="0 0 760 180" className="w-full">
          {angles.map((angle, i) => {
            const cx = 42 + i * 96;
            const t = 4; const baseW = 28; const flangeH = 26;
            const rad = (angle * Math.PI) / 180;
            const fx = Math.sin(rad) * flangeH; const fy = Math.cos(rad) * flangeH;
            const baseY = 110;
            const col = i === angles.length - 1 ? "#f97316" : `hsl(${24 + i * 4},${55 + i * 5}%,${38 + i * 3}%)`;
            return (
              <motion.g key={i} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.3 }}>
                <rect x={cx - baseW} y={baseY - t / 2} width={baseW * 2} height={t} fill={col} rx="1" />
                <line x1={cx - baseW} y1={baseY} x2={cx - baseW - fx} y2={baseY - fy} stroke={col} strokeWidth={t} strokeLinecap="round" />
                <line x1={cx + baseW} y1={baseY} x2={cx + baseW + fx} y2={baseY - fy} stroke={col} strokeWidth={t} strokeLinecap="round" />
                <text x={cx} y={baseY + 18} textAnchor="middle" fill="#71717a" fontSize="8" fontFamily="monospace">ST.{i + 1}</text>
                <text x={cx} y={baseY + 28} textAnchor="middle" fill={col} fontSize="9" fontFamily="monospace" fontWeight="bold">{angle}°</text>
              </motion.g>
            );
          })}
        </svg>
        <motion.div className="flex justify-center gap-6 mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>
          {[{ l: "Springback", v: "3.2°", c: "#f59e0b" }, { l: "Stations", v: "8", c: "#06b6d4" }, { l: "Method", v: "Constant Arc", c: "#a78bfa" }].map((m, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-lg text-center">
              <div className="text-xs text-zinc-500 mb-1">{m.l}</div>
              <div className="text-lg font-bold font-mono" style={{ color: m.c }}>{m.v}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function SceneRollTooling() {
  const stations = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div className="flex gap-8 items-center w-full h-full p-8 max-w-5xl mx-auto">
      <div className="flex-1">
        <motion.div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <div className="grid grid-cols-4 gap-2 p-3 bg-zinc-800/50 text-xs font-bold text-zinc-400 uppercase tracking-wider">
            <span>Station</span><span>Top Ø</span><span>Btm Ø</span><span>Material</span>
          </div>
          {stations.map((st, i) => (
            <motion.div key={st} className="grid grid-cols-4 gap-2 p-2.5 border-t border-zinc-800/50 text-sm font-mono"
              initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 + i * 0.15 }}>
              <span className="text-orange-400">ST {st.toString().padStart(2, "0")}</span>
              <span className="text-white">Ø{175 + st * 0.5}</span>
              <span className="text-white">Ø{172 + st * 0.3}</span>
              <span className="text-zinc-500">D2 60HRC</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.svg viewBox="0 0 200 200" className="w-56" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} transition={{ delay: 2, duration: 1.5 }}>
          <ellipse cx="100" cy="60" rx="80" ry="20" fill="#f97316" opacity="0.8" />
          <rect x="20" y="60" width="160" height="40" fill="url(#rt-grad)" />
          <ellipse cx="100" cy="100" rx="80" ry="20" fill="#7c2d12" />
          <rect x="20" y="110" width="160" height="40" fill="#f59e0b" opacity="0.6" />
          <ellipse cx="100" cy="150" rx="80" ry="20" fill="#f59e0b" opacity="0.8" />
          <defs><linearGradient id="rt-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" /><stop offset="100%" stopColor="#7c2d12" /></linearGradient></defs>
        </motion.svg>
        <motion.div className="mt-4 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.5 }}>
          <div className="text-3xl font-bold text-orange-400">16 Rolls</div>
          <div className="text-sm text-zinc-500">8 Stations × 2 (Top + Bottom)</div>
        </motion.div>
      </div>
    </div>
  );
}

function SceneGCode() {
  const lines = [
    "G21 (Metric)", "G28 U0 W0 (Home)", "T0202 (VNMG 060108)", "G96 S200 M03",
    "G00 X180.0 Z2.0", "G71 U2.0 R0.5 (Rough Cycle)", "G71 P100 Q200 U0.3 W0.1 F0.175",
    "N100 G01 X-1.0 F0.175", "X40.0 Z0.0", "G03 X50.0 Z-5.0 R5.0",
    "G01 Z-85.0", "G02 X80.0 Z-90.0 R5.0", "N200 G01 X180.0",
    "G70 P100 Q200 (Finish)", "G28 U0 W0", "M30 (End)",
  ];
  return (
    <div className="flex gap-8 items-center w-full h-full p-8 max-w-5xl mx-auto">
      <div className="flex-1">
        <motion.div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="text-zinc-600 text-[10px] ml-2">roll_st01.tap — Delta 2X CNC</span>
          </div>
          {lines.map((line, i) => (
            <motion.div key={i} className={`py-0.5 ${line.startsWith("G71") || line.startsWith("G70") ? "text-orange-400" : line.startsWith("T") ? "text-cyan-400" : line.includes("(") ? "text-zinc-600" : "text-green-400"}`}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.15 }}>
              <span className="text-zinc-700 mr-3">N{(i * 10).toString().padStart(4, "0")}</span>{line}
            </motion.div>
          ))}
        </motion.div>
      </div>
      <div className="flex-1 space-y-4">
        <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>
          <div className="text-sm text-zinc-400 mb-2">Supported Controllers</div>
          {["Delta 2X (Primary)", "Fanuc 0i-TF", "Siemens 828D", "Haas ST-10", "Mitsubishi M80", "Generic ISO"].map((c, i) => (
            <motion.div key={c} className={`py-2 px-4 rounded-lg mb-2 text-sm font-medium ${i === 0 ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-zinc-900 text-zinc-400"}`}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 3.5 + i * 0.2 }}>
              {i === 0 ? "★ " : ""}{c}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function SceneMachineLoad() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-4xl grid grid-cols-4 gap-4">
        {[
          { label: "Forming Force", value: "12.5 kN", icon: <Zap className="w-5 h-5" />, color: "#f97316", delay: 0.5 },
          { label: "Motor HP", value: "7.5 HP", icon: <Activity className="w-5 h-5" />, color: "#06b6d4", delay: 1 },
          { label: "Gear Ratio", value: "1:25", icon: <Settings className="w-5 h-5" />, color: "#a78bfa", delay: 1.5 },
          { label: "Bearing", value: "6210 ZZ", icon: <Target className="w-5 h-5" />, color: "#34d399", delay: 2 },
        ].map((item, i) => (
          <motion.div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: item.delay, ease }}>
            <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: `${item.color}20`, color: item.color }}>{item.icon}</div>
            <div className="text-xs text-zinc-500 mb-1">{item.label}</div>
            <div className="text-xl font-bold font-mono" style={{ color: item.color }}>{item.value}</div>
          </motion.div>
        ))}
      </div>
      <motion.div className="mt-8 w-full max-w-4xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="text-sm text-zinc-400 mb-4 font-bold">Engineering Chain</div>
          <div className="flex items-center justify-between">
            {["Strip Width", "Bending Force", "Motor Power", "Gear Ratio", "Bearing", "Shaft Check"].map((s, i) => (
              <React.Fragment key={i}>
                <motion.div className="text-xs text-center bg-zinc-800 px-3 py-2 rounded-lg" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 3.5 + i * 0.3 }}>
                  <div className={i === 5 ? "text-green-400" : "text-orange-400"}>{s}</div>
                </motion.div>
                {i < 5 && <motion.span className="text-zinc-600" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.8 + i * 0.3 }}>→</motion.span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SceneAutoCAD() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <motion.div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, ease }}>
        <div className="bg-zinc-800 px-4 py-2 flex justify-between items-center">
          <span className="text-xs text-zinc-400 font-mono">AutoCAD Engineering Drawing — A3 Sheet</span>
          <div className="flex gap-2">
            {["A4", "A3", "A2"].map((s, i) => (
              <span key={s} className={`text-xs px-2 py-0.5 rounded ${i === 1 ? "bg-orange-500/20 text-orange-400" : "text-zinc-500"}`}>{s}</span>
            ))}
          </div>
        </div>
        <div className="p-6">
          <svg viewBox="0 0 420 297" className="w-full border border-zinc-700 bg-zinc-950">
            <rect x="10" y="10" width="400" height="277" fill="none" stroke="#374151" strokeWidth="1" />
            <rect x="290" y="245" width="115" height="37" fill="none" stroke="#374151" strokeWidth="0.5" />
            <motion.text x="347" y="258" textAnchor="middle" fill="#f97316" fontSize="5" fontFamily="monospace"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>SAI ROLOTECH</motion.text>
            <motion.text x="347" y="268" textAnchor="middle" fill="#71717a" fontSize="4" fontFamily="monospace"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>C-Channel 100×50×1.5</motion.text>
            <motion.path d="M 60 180 L 60 60 L 360 60 L 360 180" fill="none" stroke="#f97316" strokeWidth="1.5"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 2, duration: 2.5 }} />
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4 }}>
              <line x1="60" y1="195" x2="360" y2="195" stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="3 2" />
              <text x="210" y="205" textAnchor="middle" fill="#06b6d4" fontSize="5" fontFamily="monospace">100.00</text>
              <line x1="45" y1="60" x2="45" y2="180" stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="3 2" />
              <text x="35" y="125" textAnchor="middle" fill="#06b6d4" fontSize="5" fontFamily="monospace" transform="rotate(-90 35 125)">50.00</text>
            </motion.g>
          </svg>
        </div>
        <motion.div className="flex gap-3 px-6 pb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 5 }}>
          {["DXF Export", "PNG Export", "PDF Export"].map((e, i) => (
            <div key={e} className="bg-zinc-800 px-3 py-1.5 rounded text-xs text-orange-400 flex items-center gap-1"><Download className="w-3 h-3" />{e}</div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

function SceneRollDataFiles() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-4xl grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((st, i) => (
          <motion.div key={st} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3 + i * 0.3, ease }}>
            <div className="text-xs text-orange-400 font-bold mb-3">Station {st.toString().padStart(2, "0")}</div>
            <svg viewBox="0 0 120 80" className="w-full mb-2">
              <motion.ellipse cx="60" cy="20" rx="45" ry="12" fill="none" stroke="#f97316" strokeWidth="1.5"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5 + i * 0.3, duration: 1 }} />
              <motion.path d={`M 25 50 L 25 ${50 - st * 3} L 95 ${50 - st * 3} L 95 50`} fill="none" stroke="#06b6d4" strokeWidth="1"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1 + i * 0.3, duration: 1 }} />
              <motion.ellipse cx="60" cy="65" rx="50" ry="10" fill="none" stroke="#f59e0b" strokeWidth="1.5"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.5 + i * 0.3, duration: 1 }} />
            </svg>
            <div className="flex justify-between text-[10px]">
              <span className="text-orange-400">UP Roll</span>
              <span className="text-cyan-400">Strip</span>
              <span className="text-amber-400">DN Roll</span>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div className="mt-6 flex items-center gap-3 bg-orange-500/10 border border-orange-500/30 px-6 py-3 rounded-full"
        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 4 }}>
        <Download className="w-4 h-4 text-orange-400" />
        <span className="text-sm text-orange-400 font-bold">ZIP Download — All SVGs + CSV Index</span>
      </motion.div>
    </div>
  );
}

function SceneBuddyCRM() {
  const agents = [
    { name: "BUDDY", role: "Coordinator", color: "#f97316", icon: "🤖" },
    { name: "Lead Scout", role: "Lead Finder", color: "#06b6d4", icon: "🔍" },
    { name: "WA Bot", role: "WhatsApp", color: "#22c55e", icon: "💬" },
    { name: "Qualifier", role: "Lead Scoring", color: "#a78bfa", icon: "⭐" },
    { name: "Analytics", role: "Reports", color: "#f43f5e", icon: "📊" },
  ];
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-4xl flex gap-4 mb-8">
        {agents.map((a, i) => (
          <motion.div key={i} className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.3, ease }}>
            <div className="text-2xl mb-2">{a.icon}</div>
            <div className="text-sm font-bold" style={{ color: a.color }}>{a.name}</div>
            <div className="text-[10px] text-zinc-500">{a.role}</div>
          </motion.div>
        ))}
      </div>
      <motion.div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-xl p-5"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>
        <div className="text-xs text-zinc-400 mb-3 font-bold">Lead Pipeline</div>
        <ProgressBar label="Hot Leads" value={85} max={100} color="#f97316" delay={3.5} />
        <ProgressBar label="Warm Leads" value={62} max={100} color="#f59e0b" delay={4} />
        <ProgressBar label="Cold Leads" value={35} max={100} color="#06b6d4" delay={4.5} />
      </motion.div>
    </div>
  );
}

function Scene3DView() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-4xl grid grid-cols-2 gap-6">
        {[
          { title: "Digital Twin", desc: "Machine simulation & visualization", icon: <Monitor className="w-8 h-8" />, color: "#06b6d4" },
          { title: "3D Studio", desc: "3D CAD + CAM + Smart", icon: <Box className="w-8 h-8" />, color: "#a78bfa" },
          { title: "Flower 2D+3D", desc: "Combined side-by-side view", icon: <Layers className="w-8 h-8" />, color: "#f97316" },
          { title: "Roll Machine", desc: "9-station animated machine", icon: <Activity className="w-8 h-8" />, color: "#34d399" },
        ].map((item, i) => (
          <motion.div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center gap-4"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.5, ease }}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `${item.color}15`, color: item.color }}>
              {item.icon}
            </div>
            <div>
              <div className="font-bold text-white">{item.title}</div>
              <div className="text-xs text-zinc-500">{item.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div className="mt-8 w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-xl p-6"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>
        <div className="flex items-center justify-center gap-8">
          <svg viewBox="0 0 200 100" className="w-48">
            <motion.rect x="10" y="30" width="180" height="40" rx="8" fill="none" stroke="#f97316" strokeWidth="2"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 3.5, duration: 1.5 }} />
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <motion.circle key={i} cx={20 + i * 20} cy="50" r="8" fill="none" stroke="#f59e0b" strokeWidth="1.5"
                initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }}
                transition={{ delay: 4 + i * 0.15, duration: 1.5, rotate: { repeat: Infinity, duration: 2 } }} />
            ))}
          </svg>
          <div className="text-sm text-zinc-400">9 Stations • Spinning Rollers • Live Animation</div>
        </div>
      </motion.div>
    </div>
  );
}

function SceneAnalysis() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-4xl grid grid-cols-3 gap-4">
        {[
          { title: "FEA Simulation", val: "σ = 285 MPa", color: "#f97316" },
          { title: "Springback", val: "Δθ = 3.2°", color: "#06b6d4" },
          { title: "Strip Width", val: "247.3 mm", color: "#a78bfa" },
          { title: "Roll Gap", val: "1.15 mm", color: "#34d399" },
          { title: "Cost Estimator", val: "₹12,450/unit", color: "#f59e0b" },
          { title: "Camber", val: "0.8 mm/m", color: "#f43f5e" },
          { title: "Forming Energy", val: "4.2 kJ", color: "#06b6d4" },
          { title: "Material DB", val: "50+ metals", color: "#a78bfa" },
          { title: "DTM Strain", val: "ε = 0.12", color: "#34d399" },
        ].map((item, i) => (
          <motion.div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.2 }}>
            <div className="text-xs text-zinc-500 mb-2">{item.title}</div>
            <div className="text-lg font-mono font-bold" style={{ color: item.color }}>{item.val}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SceneSafety() {
  const checks = [
    { label: "Machine Homing Check", status: "PASS", delay: 0.5 },
    { label: "Tool Offset Verified", status: "PASS", delay: 1 },
    { label: "Spindle Speed Limits", status: "PASS", delay: 1.5 },
    { label: "Feed Rate Safety", status: "PASS", delay: 2 },
    { label: "Collision Detection", status: "PASS", delay: 2.5 },
    { label: "Coolant System", status: "PASS", delay: 3 },
    { label: "Emergency Stop Test", status: "PASS", delay: 3.5 },
    { label: "Door Interlock", status: "PASS", delay: 4 },
  ];
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-md">
        <motion.div className="text-center mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Shield className="w-12 h-12 text-green-400 mx-auto mb-2" />
          <div className="text-lg font-bold text-white">Pre-Run Safety Check</div>
          <div className="text-xs text-zinc-500">Delta 2X CNC Lathe — 8 Point Inspection</div>
        </motion.div>
        {checks.map((c, i) => (
          <motion.div key={i} className="flex items-center justify-between py-2.5 px-4 border-b border-zinc-800"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: c.delay }}>
            <span className="text-sm text-zinc-300">{c.label}</span>
            <motion.span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: c.delay + 0.3 }}>
              ✓ {c.status}
            </motion.span>
          </motion.div>
        ))}
        <motion.div className="mt-6 text-center bg-green-500/10 border border-green-500/30 py-3 rounded-xl"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 5 }}>
          <span className="text-green-400 font-bold text-lg">ALL 8 CHECKS PASSED — SAFE TO RUN</span>
        </motion.div>
      </div>
    </div>
  );
}

function SceneValidation() {
  const layers = [
    { name: "Material Properties", score: 98, color: "#f97316" },
    { name: "Springback Accuracy", score: 95, color: "#06b6d4" },
    { name: "Strain Analysis", score: 97, color: "#a78bfa" },
    { name: "Machine Compatibility", score: 100, color: "#34d399" },
    { name: "BOM Validation", score: 92, color: "#f59e0b" },
    { name: "G-Code Verification", score: 96, color: "#f43f5e" },
    { name: "Roll Tooling Check", score: 99, color: "#06b6d4" },
    { name: "AI Certification", score: 94, color: "#a78bfa" },
    { name: "Safety Compliance", score: 100, color: "#34d399" },
    { name: "Export Readiness", score: 98, color: "#f97316" },
  ];
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8">
      <div className="w-full max-w-2xl">
        <motion.div className="text-center mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="text-lg font-bold text-white">10-Layer Validation Pipeline</div>
        </motion.div>
        {layers.map((l, i) => (
          <ProgressBar key={i} label={l.name} value={l.score} max={100} color={l.color} delay={0.3 + i * 0.25} />
        ))}
        <motion.div className="mt-4 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4 }}>
          <div className="text-2xl font-bold text-green-400">Overall: 96.9% — Grade S+</div>
        </motion.div>
      </div>
    </div>
  );
}

const DEMO_SCENES: DemoScene[] = [
  { id: "setup", title: "Setup & Configuration", subtitle: "Profile, Material, Machine Settings", icon: <Settings className="w-6 h-6" />, color: "#f97316", duration: 8000, render: SceneSetup },
  { id: "dxf", title: "DXF / DWG Import", subtitle: "AutoCAD Drawing → Profile Extraction", icon: <FileCode2 className="w-6 h-6" />, color: "#06b6d4", duration: 8000, render: SceneDXFImport },
  { id: "flower", title: "Flower Pattern", subtitle: "Multi-Pass Forming Sequence", icon: <Flower className="w-6 h-6" />, color: "#a78bfa", duration: 8000, render: SceneFlower },
  { id: "roll", title: "Roll Tooling Design", subtitle: "Per-Station Top & Bottom Roll Calc", icon: <Wrench className="w-6 h-6" />, color: "#f59e0b", duration: 8000, render: SceneRollTooling },
  { id: "gcode", title: "G-Code Generation", subtitle: "Delta 2X + 6 CNC Controllers", icon: <FileCode2 className="w-6 h-6" />, color: "#34d399", duration: 8000, render: SceneGCode },
  { id: "machine-load", title: "Machine Load Calculator", subtitle: "Force → Motor → Gear → Bearing", icon: <Activity className="w-6 h-6" />, color: "#f97316", duration: 8000, render: SceneMachineLoad },
  { id: "autocad", title: "AutoCAD Engineering Drawing", subtitle: "Professional A3/A2 Sheet with Dims", icon: <Ruler className="w-6 h-6" />, color: "#06b6d4", duration: 8000, render: SceneAutoCAD },
  { id: "roll-data", title: "Roll Data Files (SVG)", subtitle: "Per-Station SVG + ZIP Download", icon: <Download className="w-6 h-6" />, color: "#a78bfa", duration: 8000, render: SceneRollDataFiles },
  { id: "buddy", title: "BUDDY AI CRM", subtitle: "5 AI Agents — Lead Management", icon: <Bot className="w-6 h-6" />, color: "#f59e0b", duration: 8000, render: SceneBuddyCRM },
  { id: "3d", title: "3D Visualization & Simulation", subtitle: "Digital Twin, 3D Studio, Machine", icon: <Box className="w-6 h-6" />, color: "#34d399", duration: 8000, render: Scene3DView },
  { id: "analysis", title: "Engineering Analysis (9 Tools)", subtitle: "FEA, Springback, Cost, Camber", icon: <BarChart3 className="w-6 h-6" />, color: "#f43f5e", duration: 8000, render: SceneAnalysis },
  { id: "safety", title: "Safety & Pre-Run Checks", subtitle: "8-Point CNC Safety Inspection", icon: <Shield className="w-6 h-6" />, color: "#22c55e", duration: 8000, render: SceneSafety },
  { id: "validation", title: "10-Layer Validation Pipeline", subtitle: "Complete Quality Certification", icon: <Eye className="w-6 h-6" />, color: "#8b5cf6", duration: 8000, render: SceneValidation },
];

export function DemoVideoCenter() {
  const [activeScene, setActiveScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    const currentScene = DEMO_SCENES[activeScene] ?? DEMO_SCENES[0];
    const dur = currentScene.duration;
    const startTime = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min((elapsed / dur) * 100, 100));
      if (elapsed >= dur) {
        setActiveScene(s => (s + 1) % DEMO_SCENES.length);
        setProgress(0);
      }
    }, 50);
    return () => clearInterval(iv);
  }, [activeScene, isPlaying]);

  const goTo = useCallback((idx: number) => { setActiveScene(idx); setProgress(0); }, []);

  const scene = DEMO_SCENES[activeScene] ?? DEMO_SCENES[0];
  const SceneRenderer = scene.render;

  return (
    <div className="h-full flex flex-col bg-[#08080f] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Play className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Demo Video Center</div>
            <div className="text-[10px] text-zinc-500">{DEMO_SCENES.length} Animated Feature Walkthroughs</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => goTo((activeScene - 1 + DEMO_SCENES.length) % DEMO_SCENES.length)}
            className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button onClick={() => goTo((activeScene + 1) % DEMO_SCENES.length)}
            className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-xs text-zinc-500 ml-2 font-mono">{activeScene + 1} / {DEMO_SCENES.length}</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 border-r border-zinc-800 overflow-y-auto bg-zinc-900/30 py-2">
          {DEMO_SCENES.map((s, i) => (
            <button key={s.id} onClick={() => goTo(i)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all ${i === activeScene ? "bg-orange-500/10 border-l-2 border-orange-500" : "border-l-2 border-transparent hover:bg-zinc-800/50"}`}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: i === activeScene ? `${s.color}20` : "transparent", color: i === activeScene ? s.color : "#71717a" }}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-medium truncate ${i === activeScene ? "text-white" : "text-zinc-400"}`}>{s.title}</div>
                <div className="text-[10px] text-zinc-600 truncate">{s.subtitle}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${scene.color}15`, color: scene.color }}>
                {scene.icon}
              </div>
              <div>
                <div className="text-lg font-bold text-white">{scene.title}</div>
                <div className="text-xs text-zinc-500">{scene.subtitle}</div>
              </div>
            </div>
            <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: scene.color, width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div key={scene.id} className="absolute inset-0"
                initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5, ease }}>
                <SceneRenderer progress={progress} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
