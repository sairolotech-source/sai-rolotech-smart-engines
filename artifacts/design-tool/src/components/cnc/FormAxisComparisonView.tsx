import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Check, X, Minus, Award, BarChart2, Zap, Globe, Shield,
  Cpu, Star, ChevronLeft, ChevronRight, Printer, Download,
  Building2, Phone, Users, IndianRupee, Layers, Settings,
  Monitor, Wrench, Target, BookOpen, ArrowRight
} from "lucide-react";

const TOTAL_SLIDES = 10;

const SAI_COLOR = "#f59e0b";
const FORMAXIS_COLOR = "#3b82f6";

function SlideWrapper({ children, slideNumber }: { children: React.ReactNode; slideNumber: number }) {
  return (
    <div className="comparison-slide" data-slide={slideNumber}>
      <div className="slide-inner">
        {children}
        <div className="slide-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#fff" }}>SAI</span>
            </div>
            <span style={{ color: "#52525b", fontSize: 11, fontWeight: 600 }}>Sai Rolotech Smart Engines — Confidential Comparison</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", width: 60 }}>
              <div style={{ height: "100%", width: `${(slideNumber / TOTAL_SLIDES) * 100}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)", borderRadius: 3 }} />
            </div>
            <span style={{ color: "#52525b", fontSize: 11, fontWeight: 700 }}>{slideNumber} / {TOTAL_SLIDES}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideHeading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(251,191,36,0.08) 100%)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <h2 style={{ fontSize: 21, fontWeight: 800, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.01em", margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: "#71717a", marginTop: 2, margin: 0 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function SlideTitlePage() {
  return (
    <SlideWrapper slideNumber={1}>
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 20, right: 60, width: 180, height: 180, borderRadius: "50%", border: "1px solid rgba(245,158,11,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 50, right: 90, width: 100, height: 100, borderRadius: "50%", border: "1px solid rgba(245,158,11,0.06)", pointerEvents: "none" }} />

        {/* Left brand strip */}
        <div style={{ width: 5, background: "linear-gradient(180deg, #f59e0b 0%, #3b82f6 50%, #6366f1 100%)", flexShrink: 0 }} />

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, textAlign: "center", padding: "44px 48px" }}>
          {/* Logo icon */}
          <div style={{ position: "relative" }}>
            <div style={{ width: 88, height: 88, borderRadius: 24, background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 12px rgba(245,158,11,0.08), 0 12px 40px rgba(245,158,11,0.35)" }}>
              <BarChart2 style={{ width: 44, height: 44, color: "#fff" }} />
            </div>
          </div>

          {/* Title */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#71717a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Software Comparison Deck</div>
            <h1 style={{ fontSize: 40, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 10, letterSpacing: "-0.02em" }}>
              Sai Rolotech <span style={{ background: "linear-gradient(90deg, #f59e0b, #fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>vs</span> FormAxis RF
            </h1>
            <p style={{ fontSize: 16, color: "#71717a", fontWeight: 500, lineHeight: 1.5 }}>
              Roll Forming · CNC · CAM · AI & Smart Features · Pricing · Support
            </p>
          </div>

          {/* Brand pills */}
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 24px", borderRadius: 14, background: "linear-gradient(90deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.06) 100%)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 4px 16px rgba(245,158,11,0.1)" }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: "linear-gradient(135deg, #f59e0b, #fbbf24)", boxShadow: "0 0 6px rgba(245,158,11,0.6)" }} />
              <span style={{ color: "#fbbf24", fontSize: 13, fontWeight: 800, letterSpacing: "0.01em" }}>SAI Rolotech Smart Engines</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 24px", borderRadius: 14, background: "linear-gradient(90deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.06) 100%)", border: "1px solid rgba(59,130,246,0.3)", boxShadow: "0 4px 16px rgba(59,130,246,0.1)" }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: "linear-gradient(135deg, #3b82f6, #60a5fa)", boxShadow: "0 0 6px rgba(59,130,246,0.6)" }} />
              <span style={{ color: "#93c5fd", fontSize: 13, fontWeight: 800, letterSpacing: "0.01em" }}>FormAxis RF — data M/s</span>
            </div>
          </div>

          <p style={{ fontSize: 12, color: "#3f3f46", marginTop: 4, maxWidth: 480, lineHeight: 1.6 }}>
            Yeh deck dono software ke beech mein har important aspect cover karta hai — features, pricing, support, aur real-world suitability.
          </p>
        </div>

        {/* Right stats column */}
        <div style={{ width: 200, background: "rgba(0,0,0,0.2)", borderLeft: "1px solid rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, padding: "32px 20px" }}>
          {[
            { val: "44", label: "Features\nCompared", color: "#f59e0b" },
            { val: "16", label: "SAI\nExclusive", color: "#34d399" },
            { val: "10", label: "Slides\nTotal", color: "#a78bfa" },
            { val: "0", label: "FormAxis\nExclusive", color: "#f87171" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "#52525b", fontWeight: 600, marginTop: 3, lineHeight: 1.4, whiteSpace: "pre-line" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideCompanyOverview() {
  const rows = [
    { label: "Company / कंपनी", sai: "Sai Rolotech (India)", formaxis: "data M/s (Germany)" },
    { label: "Founded / स्थापना", sai: "Indian-origin startup", formaxis: "1990s, Germany" },
    { label: "Product Type", sai: "All-in-one: RF + CNC + CAM + AI", formaxis: "Roll Forming design only" },
    { label: "Headquarters", sai: "India", formaxis: "Aachen, Germany" },
    { label: "Target Market", sai: "India & emerging markets", formaxis: "Global enterprise" },
    { label: "Platform", sai: "Web + Desktop + Mobile", formaxis: "Desktop only (Windows)" },
    { label: "Language", sai: "Hindi + English", formaxis: "English / German" },
    { label: "Offline Support", sai: "✅ 100% offline capable", formaxis: "❌ Internet required for license" },
    { label: "Installation", sai: "Browser — no install needed", formaxis: "Heavy desktop install" },
  ];
  return (
    <SlideWrapper slideNumber={2}>
      <div style={{ padding: "24px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
        <SlideHeading icon={<Building2 style={{ width: 20, height: 20, color: SAI_COLOR }} />} title="Company Overview" subtitle="कंपनी परिचय — Background, Platform & Target Market" />
        <div style={{ flex: 1 }}>
          <table className="deck-table">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Parameter</th>
                <th style={{ width: "35%", color: SAI_COLOR }}>🟠 SAI Rolotech</th>
                <th style={{ width: "35%", color: FORMAXIS_COLOR }}>🔵 FormAxis RF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "#d4d4d8" }}>{r.label}</td>
                  <td>{r.sai}</td>
                  <td>{r.formaxis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideRollForming() {
  const features = [
    { name: "Open Section RF Design", sai: true, formaxis: true },
    { name: "Closed Section (Tube Mill)", sai: true, formaxis: true },
    { name: "Flower Pattern Generator", sai: true, formaxis: true },
    { name: "Trapeze / Corrugated Profiles", sai: true, formaxis: true },
    { name: "Down-Hill Forming (ITA Award)", sai: true, formaxis: true },
    { name: "CageForming — Tube Mill", sai: true, formaxis: true },
    { name: "Wire Rolling", sai: true, formaxis: true },
    { name: "Drawing Dies", sai: true, formaxis: true },
    { name: "DTM — Dynamic Deformation", sai: true, formaxis: true },
    { name: "SmartRolls — AI Auto-Design", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "RF Spreadsheet Editor", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "AssemblyCheck — Real-time Validation", sai: true, formaxis: "partial" as const, exclusive: "SAI" },
  ];
  return (
    <SlideWrapper slideNumber={3}>
      <div style={{ padding: "24px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
        <SlideHeading icon={<Wrench style={{ width: 20, height: 20, color: SAI_COLOR }} />} title="Roll Forming Capabilities" subtitle="Open section, closed section, tube mill, wire rolling & more" />
        <div style={{ flex: 1 }}>
          <table className="deck-table">
            <thead>
              <tr>
                <th style={{ width: "50%" }}>Feature</th>
                <th style={{ width: "25%", color: SAI_COLOR }}>SAI Rolotech</th>
                <th style={{ width: "25%", color: FORMAXIS_COLOR }}>FormAxis RF</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, color: "#d4d4d8" }}>
                    {f.name}
                    {f.exclusive && <span className="deck-badge-sai">SAI EXCLUSIVE</span>}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {f.sai ? <Check style={{ width: 18, height: 18, color: "#34d399", margin: "0 auto" }} /> : <X style={{ width: 18, height: 18, color: "#f87171", margin: "0 auto" }} />}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {f.formaxis === true ? <Check style={{ width: 18, height: 18, color: "#34d399", margin: "0 auto" }} /> : f.formaxis === "partial" ? <Minus style={{ width: 18, height: 18, color: "#fbbf24", margin: "0 auto" }} /> : <X style={{ width: 18, height: 18, color: "#f87171", margin: "0 auto" }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "#71717a", marginTop: 8 }}>SAI mein sabhi FormAxis RF modules hain + SmartRolls AI aur RF Spreadsheet exclusive hai.</p>
      </div>
    </SlideWrapper>
  );
}

function SlideCNCCAM() {
  const features = [
    { name: "G-Code Generation (Fanuc, Siemens, Delta)", sai: true, formaxis: true },
    { name: "Post-Processor Library (9+ machines)", sai: true, formaxis: "partial" },
    { name: "Turning / Lathe (TurnAxis CAM style)", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "Milling CAM — 2.5D (Pocket, Contour, HSM)", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "5-Axis Simultaneous Milling", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "Load Calculator (Force, Torque, Power)", sai: true, formaxis: true },
    { name: "Tool Library — CNC Tool Inventory", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "Geometry Edit — Profile Chain Editor", sai: true, formaxis: false, exclusive: "SAI" },
  ];
  return (
    <SlideWrapper slideNumber={4}>
      <div style={{ padding: "24px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
        <SlideHeading icon={<Settings style={{ width: 20, height: 20, color: SAI_COLOR }} />} title="CNC & CAM Capabilities" subtitle="G-Code, Turning, Milling 2.5D/5-Axis, Post-Processor Library" />
        <div style={{ flex: 1 }}>
          <table className="deck-table">
            <thead>
              <tr>
                <th style={{ width: "50%" }}>Feature</th>
                <th style={{ width: "25%", color: SAI_COLOR }}>SAI Rolotech</th>
                <th style={{ width: "25%", color: FORMAXIS_COLOR }}>FormAxis RF</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, color: "#d4d4d8" }}>
                    {f.name}
                    {f.exclusive && <span className="deck-badge-sai">SAI EXCLUSIVE</span>}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {f.sai ? <Check style={{ width: 18, height: 18, color: "#34d399", margin: "0 auto" }} /> : <X style={{ width: 18, height: 18, color: "#f87171", margin: "0 auto" }} />}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {f.formaxis === true ? <Check style={{ width: 18, height: 18, color: "#34d399", margin: "0 auto" }} /> : f.formaxis === "partial" ? <Minus style={{ width: 18, height: 18, color: "#fbbf24", margin: "0 auto" }} /> : <X style={{ width: 18, height: 18, color: "#f87171", margin: "0 auto" }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "#71717a", marginTop: 8 }}>FormAxis sirf roll forming ke liye hai. SAI mein full CNC turning, milling, aur 5-axis CAM bhi included hai.</p>
      </div>
    </SlideWrapper>
  );
}

function SlideAnalysis() {
  const features = [
    { name: "FEA Simulation — Stress/Strain Analysis", sai: true, formaxis: true },
    { name: "Springback Prediction & Compensation", sai: true, formaxis: true },
    { name: "Strip Width Calculator (K-factor)", sai: true, formaxis: true },
    { name: "Roll Gap Analysis & Optimization", sai: true, formaxis: true },
    { name: "Camber / Strip Bow Prediction", sai: true, formaxis: true },
    { name: "Forming Energy & Force Charts", sai: true, formaxis: true },
    { name: "Material Database", sai: true, formaxis: true },
    { name: "DTM — Real-time Strain Overlay", sai: true, formaxis: true },
    { name: "Cost Estimator — Full Production Cost", sai: true, formaxis: "partial" },
    { name: "Sheet Metal — Flanges, Hems, DXF Export", sai: true, formaxis: "partial", exclusive: "SAI" },
  ];
  return (
    <SlideWrapper slideNumber={5}>
      <div style={{ padding: "24px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
        <SlideHeading icon={<Target style={{ width: 20, height: 20, color: SAI_COLOR }} />} title="Analysis & Simulation" subtitle="FEA, Springback, Strip Width, Roll Gap, Cost Estimator" />
        <div style={{ flex: 1 }}>
          <table className="deck-table">
            <thead>
              <tr>
                <th style={{ width: "50%" }}>Feature</th>
                <th style={{ width: "25%", color: SAI_COLOR }}>SAI Rolotech</th>
                <th style={{ width: "25%", color: FORMAXIS_COLOR }}>FormAxis RF</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, color: "#d4d4d8" }}>
                    {f.name}
                    {f.exclusive && <span className="deck-badge-sai">SAI EXCLUSIVE</span>}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {f.sai ? <Check style={{ width: 18, height: 18, color: "#34d399", margin: "0 auto" }} /> : <X style={{ width: 18, height: 18, color: "#f87171", margin: "0 auto" }} />}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {f.formaxis === true ? <Check style={{ width: 18, height: 18, color: "#34d399", margin: "0 auto" }} /> : f.formaxis === "partial" ? <Minus style={{ width: 18, height: 18, color: "#fbbf24", margin: "0 auto" }} /> : <X style={{ width: 18, height: 18, color: "#f87171", margin: "0 auto" }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "#71717a", marginTop: 8 }}>Analysis mein dono kaafi strong hain. SAI mein Sheet Metal design aur full cost estimator extra hai.</p>
      </div>
    </SlideWrapper>
  );
}

function SlideAISmart() {
  const features = [
    { name: "Offline AI Engine — 500+ Patterns", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "Defect Diagnosis AI — 12 Defect Types", sai: true, formaxis: "partial" },
    { name: "Smart Design Score — Real-time Accuracy", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "5 Expert AI Chatbots", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "Wizard Mode — Step-by-step Guided", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "Auto AI Mode — Flower → Roll → G-Code", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "Factory Smart — 8-Module Intelligence", sai: true, formaxis: false, exclusive: "SAI" },
    { name: "Smart Dashboard — System/Memory/Files", sai: true, formaxis: false, exclusive: "SAI" },
  ];
  return (
    <SlideWrapper slideNumber={6}>
      <div style={{ padding: "24px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
        <SlideHeading icon={<Cpu style={{ width: 20, height: 20, color: SAI_COLOR }} />} title="AI & Smart Features" subtitle="SAI ka sabse bada advantage — FormAxis mein 0 AI features hain" />
        <div style={{ flex: 1 }}>
          <table className="deck-table">
            <thead>
              <tr>
                <th style={{ width: "50%" }}>Feature</th>
                <th style={{ width: "25%", color: SAI_COLOR }}>SAI Rolotech</th>
                <th style={{ width: "25%", color: FORMAXIS_COLOR }}>FormAxis RF</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, color: "#d4d4d8" }}>
                    {f.name}
                    {f.exclusive && <span className="deck-badge-sai">SAI EXCLUSIVE</span>}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <Check style={{ width: 18, height: 18, color: "#34d399", margin: "0 auto" }} />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {f.formaxis === true ? <Check style={{ width: 18, height: 18, color: "#34d399", margin: "0 auto" }} /> : f.formaxis === "partial" ? <Minus style={{ width: 18, height: 18, color: "#fbbf24", margin: "0 auto" }} /> : <X style={{ width: 18, height: 18, color: "#f87171", margin: "0 auto" }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "#71717a", marginTop: 8 }}>AI / Smart Tools — yeh SAI ka sabse bada advantage hai. FormAxis mein koi AI feature nahi hai.</p>
      </div>
    </SlideWrapper>
  );
}

function SlidePricing() {
  const rows = [
    { label: "Pricing Model / कीमत", sai: "Affordable — Indian market pricing", formaxis: "Premium — European enterprise pricing" },
    { label: "Approximate Annual Cost", sai: "₹1–3 Lakh / year (estimated)", formaxis: "€5,000–15,000+ / year per module" },
    { label: "Per Module Pricing", sai: "All-in-one package — sab included", formaxis: "Alag-alag module khareedna padta hai" },
    { label: "Free Trial / Demo", sai: "Available — browser mein try karo", formaxis: "Contact sales only" },
    { label: "License Type", sai: "Flexible — online + offline", formaxis: "Dongle / node-locked license" },
    { label: "Hidden Costs", sai: "No hidden costs — transparent", formaxis: "Maintenance fee + training extra" },
    { label: "ROI for Small Shop", sai: "⭐ Best — affordable for small units", formaxis: "Expensive for small businesses" },
    { label: "ROI for Enterprise", sai: "Good — scales well", formaxis: "Industry standard for large companies" },
  ];
  return (
    <SlideWrapper slideNumber={7}>
      <div style={{ padding: "24px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
        <SlideHeading icon={<IndianRupee style={{ width: 20, height: 20, color: SAI_COLOR }} />} title="Pricing & Value / कीमत तुलना" subtitle="Annual cost, per-module pricing, ROI for Indian market" />
        <div style={{ flex: 1 }}>
          <table className="deck-table">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Parameter</th>
                <th style={{ width: "35%", color: SAI_COLOR }}>🟠 SAI Rolotech</th>
                <th style={{ width: "35%", color: FORMAXIS_COLOR }}>🔵 FormAxis RF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "#d4d4d8" }}>{r.label}</td>
                  <td>{r.sai}</td>
                  <td>{r.formaxis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "#71717a", marginTop: 8 }}>Note: Exact prices vary. SAI ka pricing Indian market ke liye kaafi competitive hai. FormAxis ka pricing modules per alag hota hai.</p>
      </div>
    </SlideWrapper>
  );
}

function SlideSupportTraining() {
  const rows = [
    { label: "Customer Support", sai: "Direct WhatsApp + Call (Hindi/English)", formaxis: "Email + Portal (English/German)" },
    { label: "Response Time", sai: "Same day — direct team access", formaxis: "1–3 business days" },
    { label: "Training", sai: "In-app Wizard + Video + Live Demo", formaxis: "Paid training sessions" },
    { label: "Documentation", sai: "Built-in help + 5 AI Experts", formaxis: "PDF manuals + paid workshops" },
    { label: "Community", sai: "Growing Indian user base", formaxis: "Established global community" },
    { label: "Updates", sai: "Frequent — cloud-based auto-update", formaxis: "Annual release cycle" },
    { label: "Local Support (India)", sai: "⭐ Direct — India-based team", formaxis: "Through resellers only" },
    { label: "Onboarding", sai: "Free — guided wizard mode", formaxis: "Paid onboarding sessions" },
  ];
  return (
    <SlideWrapper slideNumber={8}>
      <div style={{ padding: "24px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
        <SlideHeading icon={<Users style={{ width: 20, height: 20, color: SAI_COLOR }} />} title="Support & Training / सहायता" subtitle="Response time, documentation, community & onboarding" />
        <div style={{ flex: 1 }}>
          <table className="deck-table">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Parameter</th>
                <th style={{ width: "35%", color: SAI_COLOR }}>🟠 SAI Rolotech</th>
                <th style={{ width: "35%", color: FORMAXIS_COLOR }}>🔵 FormAxis RF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "#d4d4d8" }}>{r.label}</td>
                  <td>{r.sai}</td>
                  <td>{r.formaxis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideProsAndCons() {
  return (
    <SlideWrapper slideNumber={9}>
      <div style={{ padding: "24px 32px", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <SlideHeading icon={<Award style={{ width: 20, height: 20, color: SAI_COLOR }} />} title="Pros & Cons / फायदे और कमियाँ" subtitle="Honest side-by-side evaluation — SAI vs FormAxis RF" />
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ borderRadius: 14, padding: 20, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", marginBottom: 14 }}>SAI Rolotech — Pros</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {[
                "All-in-one: RF + CNC + CAM + AI ek jagah",
                "100% offline capable — internet nahi chahiye",
                "Browser mein chale — install nahi chahiye",
                "Hindi support — Indian users ke liye easy",
                "AI-powered: Auto mode, SmartRolls, 5 experts",
                "Affordable pricing — Indian market ke liye sahi",
                "Mobile/tablet support",
                "Direct WhatsApp + call support",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 13, color: "#d4d4d8" }}>
                  <Check style={{ width: 16, height: 16, color: "#34d399", flexShrink: 0, marginTop: 2 }} />
                  {item}
                </li>
              ))}
            </ul>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fb923c", marginBottom: 10, marginTop: 14 }}>SAI — Cons</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {[
                "Newer product — enterprise track record building",
                "No direct CAD plugin (SolidWorks/CATIA) yet",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 13, color: "#a1a1aa" }}>
                  <Minus style={{ width: 16, height: 16, color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ borderRadius: 14, padding: 20, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#93c5fd", marginBottom: 14 }}>FormAxis RF — Pros</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {[
                "30+ saal ka industry experience",
                "SolidWorks, CATIA integration deep hai",
                "Advanced FEA (Abaqus/LS-DYNA)",
                "Roll forming mein specialist focus",
                "Large enterprise support network",
                "Global validation — thousands of production runs",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 13, color: "#d4d4d8" }}>
                  <Check style={{ width: 16, height: 16, color: "#34d399", flexShrink: 0, marginTop: 2 }} />
                  {item}
                </li>
              ))}
            </ul>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa", marginBottom: 10, marginTop: 14 }}>FormAxis — Cons</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {[
                "Bahut expensive — small shops ke liye mushkil",
                "No AI features — manual process hi hai",
                "No CNC turning/milling — sirf roll forming",
                "No offline mode — internet chahiye",
                "No mobile/web support — desktop only",
                "India mein direct support nahi — resellers",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 13, color: "#a1a1aa" }}>
                  <Minus style={{ width: 16, height: 16, color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideVerdict() {
  const stats = [
    { label: "SAI Total Features", value: "44/44", pct: 100, color: SAI_COLOR },
    { label: "FormAxis Total Features", value: "28/44", pct: 64, color: FORMAXIS_COLOR },
    { label: "SAI Exclusive Features", value: "16", pct: 36, color: "#34d399" },
    { label: "FormAxis Only (SAI missing)", value: "0", pct: 0, color: "#f87171" },
  ];
  return (
    <SlideWrapper slideNumber={10}>
      <div style={{ padding: "24px 32px", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <SlideHeading icon={<Zap style={{ width: 20, height: 20, color: "#34d399" }} />} title="Final Verdict / अंतिम निर्णय" subtitle="44 features compared — SAI wins on coverage, AI, pricing & flexibility" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ borderRadius: 14, padding: 16, textAlign: "center", background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22`, boxShadow: `0 4px 20px ${s.color}10`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: s.color, opacity: 0.6, borderRadius: "0 0 14px 14px" }} />
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#71717a", fontWeight: 700, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
              <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${s.color}, ${s.color}99)`, width: `${s.pct}%`, transition: "width 1s ease" }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderRadius: 14, padding: 20, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#34d399", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Star style={{ width: 18, height: 18 }} />
            Conclusion / निष्कर्ष
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>SAI Rolotech Best For:</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {[
                  "Small & mid-size roll forming shops (India)",
                  "CNC job shops wanting RF + CAM together",
                  "Shops needing offline capability",
                  "Budget-conscious manufacturers",
                  "Hindi-speaking operators",
                  "Teams wanting AI-assisted design",
                ].map((item, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6, fontSize: 12, color: "#d4d4d8" }}>
                    <ArrowRight style={{ width: 14, height: 14, color: "#fbbf24", flexShrink: 0, marginTop: 1 }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd", marginBottom: 8 }}>FormAxis Best For:</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {[
                  "Large enterprise roll forming companies",
                  "Automotive OEMs with existing FormAxis workflows",
                  "Companies needing SolidWorks/CATIA integration",
                  "Organizations with large training budgets",
                ].map((item, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6, fontSize: 12, color: "#d4d4d8" }}>
                    <ArrowRight style={{ width: 14, height: 14, color: "#93c5fd", flexShrink: 0, marginTop: 1 }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p style={{ fontSize: 13, color: "#fef3c7", fontWeight: 600, lineHeight: 1.6 }}>
              SAI Rolotech Smart Engines — 100% feature coverage + 16 exclusive features jo FormAxis mein nahi hain.
              Indian market ke liye best ROI. Affordable, offline-capable, AI-powered, aur browser mein chalta hai.
            </p>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

export function FormAxisComparisonView() {
  const [currentSlide, setCurrentSlide] = useState(1);
  const [showAllSlides, setShowAllSlides] = useState(false);
  const deckRef = useRef<HTMLDivElement>(null);
  const printTriggeredByButton = useRef(false);

  const goTo = (n: number) => {
    if (n >= 1 && n <= TOTAL_SLIDES) setCurrentSlide(n);
  };

  useEffect(() => {
    const onBeforePrint = () => {
      setShowAllSlides(true);
    };
    const onAfterPrint = () => {
      printTriggeredByButton.current = false;
      setShowAllSlides(false);
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  const handlePrint = () => {
    printTriggeredByButton.current = true;
    setShowAllSlides(true);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const slides = [
    <SlideTitlePage key={1} />,
    <SlideCompanyOverview key={2} />,
    <SlideRollForming key={3} />,
    <SlideCNCCAM key={4} />,
    <SlideAnalysis key={5} />,
    <SlideAISmart key={6} />,
    <SlidePricing key={7} />,
    <SlideSupportTraining key={8} />,
    <SlideProsAndCons key={9} />,
    <SlideVerdict key={10} />,
  ];

  const slideNames = [
    "Title", "Company Overview", "Roll Forming", "CNC & CAM",
    "Analysis", "AI & Smart", "Pricing", "Support", "Pros & Cons", "Verdict"
  ];

  return (
    <div ref={deckRef} className="comparison-deck-root" style={{ display: "flex", flexDirection: "column", height: "100%", background: "#05060f", overflow: "hidden" }}>
      {/* Premium Toolbar */}
      <div className="deck-toolbar no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(90deg, rgba(12,13,31,0.98) 0%, rgba(10,11,26,0.98) 100%)", backdropFilter: "blur(20px)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart2 style={{ width: 16, height: 16, color: "#fff" }} />
          </div>
          <div>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>SAI vs FormAxis</span>
            <span style={{ fontSize: 11, color: "#52525b", marginLeft: 8 }}>Comparison Deck</span>
          </div>
          <div style={{ height: 16, width: 1, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />
          <div style={{ display: "flex", gap: 4 }}>
            <span style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 700, border: "1px solid rgba(245,158,11,0.2)" }}>SAI</span>
            <span style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "rgba(59,130,246,0.12)", color: "#60a5fa", fontWeight: 700, border: "1px solid rgba(59,130,246,0.2)" }}>FormAxis RF</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => goTo(currentSlide - 1)} disabled={currentSlide === 1}
            style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: currentSlide === 1 ? "transparent" : "rgba(255,255,255,0.04)", color: currentSlide === 1 ? "#3f3f46" : "#a1a1aa", display: "flex", alignItems: "center", justifyContent: "center", cursor: currentSlide === 1 ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
          <select value={currentSlide} onChange={(e) => goTo(Number(e.target.value))}
            style={{ height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#d4d4d8", fontSize: 12, padding: "0 10px", cursor: "pointer", outline: "none" }}>
            {slideNames.map((name, i) => (
              <option key={i} value={i + 1} style={{ background: "#0c0d1f", color: "#d4d4d8" }}>{i + 1}. {name}</option>
            ))}
          </select>
          <button onClick={() => goTo(currentSlide + 1)} disabled={currentSlide === TOTAL_SLIDES}
            style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: currentSlide === TOTAL_SLIDES ? "transparent" : "rgba(255,255,255,0.04)", color: currentSlide === TOTAL_SLIDES ? "#3f3f46" : "#a1a1aa", display: "flex", alignItems: "center", justifyContent: "center", cursor: currentSlide === TOTAL_SLIDES ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
            <ChevronRight style={{ width: 16, height: 16 }} />
          </button>
          <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.07)", margin: "0 4px" }} />
          <button onClick={handlePrint}
            style={{ height: 32, borderRadius: 9, border: "1px solid rgba(245,158,11,0.4)", background: "linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(251,191,36,0.10) 100%)", color: "#fbbf24", fontSize: 12, fontWeight: 700, padding: "0 16px", display: "flex", alignItems: "center", gap: 7, cursor: "pointer", boxShadow: "0 2px 12px rgba(245,158,11,0.15)", letterSpacing: "0.01em" }}>
            <Download style={{ width: 13, height: 13 }} />
            Download PDF
          </button>
        </div>
      </div>

      <div className="deck-slide-area" style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 16px", background: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.04) 0%, transparent 60%)" }}>
        {showAllSlides ? (
          <div className="deck-print-all">{slides}</div>
        ) : (
          slides[currentSlide - 1]
        )}
      </div>

      {/* Premium dot nav */}
      <div className="deck-nav-dots no-print" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(10,11,26,0.98)", flexShrink: 0 }}>
        {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
          <button key={i} onClick={() => goTo(i + 1)} title={slideNames[i]}
            style={{ width: currentSlide === i + 1 ? 28 : 7, height: 7, borderRadius: 4, border: "none", background: currentSlide === i + 1 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "rgba(255,255,255,0.10)", cursor: "pointer", transition: "all 0.25s ease", boxShadow: currentSlide === i + 1 ? "0 0 8px rgba(245,158,11,0.5)" : "none" }} />
        ))}
      </div>
    </div>
  );
}
