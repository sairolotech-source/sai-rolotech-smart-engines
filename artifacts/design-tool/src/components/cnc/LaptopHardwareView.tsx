import React, { useState, useEffect, useRef } from "react";
import {
  Cpu, MemoryStick, Monitor, Wifi, Battery, Usb,
  Activity, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Link, Send, Terminal, Zap,
} from "lucide-react";
import { detectLaptopHardware, connectToSerialPort, sendGCodeToSerial, type LaptopHardwareInfo, type WebSerialPort } from "../../lib/laptop-hardware";

const C = {
  bg: "#0a0a0f",
  card: "#12121a",
  border: "rgba(255,255,255,0.07)",
  text: "rgba(255,255,255,0.9)",
  sub: "rgba(255,255,255,0.45)",
  green: "#22c55e",
  yellow: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#a855f7",
  cyan: "#06b6d4",
};

function Card({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} style={{ color }} />
        <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean | null }) {
  return (
    <div className="flex justify-between items-center py-1" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.sub, fontSize: 11 }}>{label}</span>
      <div className="flex items-center gap-1">
        {ok === true && <CheckCircle2 size={11} style={{ color: C.green }} />}
        {ok === false && <XCircle size={11} style={{ color: C.red }} />}
        <span style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>{value}</span>
      </div>
    </div>
  );
}

function Badge({ label, active }: { label: string; active: boolean }) {
  return (
    <span style={{
      background: active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.1)",
      color: active ? C.green : C.red,
      border: `1px solid ${active ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.2)"}`,
      borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 600,
    }}>{label}: {active ? "✓" : "✗"}</span>
  );
}

export default function LaptopHardwareView() {
  const [hw, setHw] = useState<LaptopHardwareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverHw, setServerHw] = useState<any>(null);
  const [serialPort, setSerialPort] = useState<WebSerialPort | null>(null);
  const [serialConnected, setSerialConnected] = useState(false);
  const [gcode, setGcode] = useState("G28 ; Home all axes\nG1 X10 Y10 F1000\nM114 ; Get position");
  const [serialLog, setSerialLog] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const scanHardware = async () => {
    setLoading(true);
    try {
      const info = await detectLaptopHardware();
      setHw(info);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchServerHardware = async () => {
    try {
      const res = await fetch("/api/system/hardware-full");
      if (res.ok) setServerHw(await res.json());
    } catch {}
  };

  useEffect(() => {
    scanHardware();
    fetchServerHardware();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [serialLog]);

  const connectSerial = async () => {
    try {
      addLog("⏳ CNC machine se connect ho raha hai...");
      const port = await connectToSerialPort(115200);
      setSerialPort(port);
      setSerialConnected(true);
      addLog("✅ CNC machine connected! Port open — baudrate 115200");

      const reader = port.readable?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        (async () => {
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              const text = decoder.decode(value);
              addLog(`← ${text.trim()}`);
            }
          } catch {}
        })();
      }
    } catch (e: any) {
      addLog(`❌ Error: ${e.message}`);
    }
  };

  const disconnectSerial = async () => {
    try {
      if (serialPort) {
        await serialPort.close();
        setSerialPort(null);
        setSerialConnected(false);
        addLog("🔌 CNC machine disconnected");
      }
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
  };

  const sendGCode = async () => {
    if (!serialPort || !gcode.trim()) return;
    setSending(true);
    try {
      addLog(`→ G-code bhejna shuru...`);
      await sendGCodeToSerial(serialPort, gcode);
      addLog(`✅ G-code bhej diya! (${gcode.split("\n").filter(l => l.trim() && !l.startsWith(";")).length} commands)`);
    } catch (e: any) {
      addLog(`❌ Send Error: ${e.message}`);
    }
    setSending(false);
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("en-IN", { hour12: false });
    setSerialLog(prev => [...prev.slice(-100), `[${time}] ${msg}`]);
  };

  const perfColor = (p: string) =>
    p === "ultra" ? C.purple : p === "high" ? C.green : p === "medium" ? C.yellow : C.red;

  const tierColor = (t: string) =>
    t === "dedicated" ? C.purple : t === "integrated" ? C.cyan : C.sub;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: 20, fontFamily: "monospace" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: 0 }}>Hardware Dashboard</h1>
          <p style={{ color: C.sub, fontSize: 12, margin: "4px 0 0" }}>Laptop + CNC Machine Real-time Detection</p>
        </div>
        <button
          onClick={() => { scanHardware(); fetchServerHardware(); }}
          disabled={loading}
          style={{ background: "rgba(59,130,246,0.15)", border: `1px solid ${C.blue}`, color: C.blue, borderRadius: 8, padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Scan..." : "Scan Hardware"}
        </button>
      </div>

      {!hw && loading && (
        <div className="flex items-center justify-center" style={{ height: 200 }}>
          <div style={{ color: C.sub, fontSize: 13 }}>Hardware detect ho raha hai...</div>
        </div>
      )}

      {hw && (
        <>
          {/* Browser Capabilities */}
          <Card title="Browser Capabilities" icon={Monitor} color={C.cyan}>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge label="WebSerial (CNC)" active={hw.browser.webSerialSupported} />
              <Badge label="WebUSB" active={hw.browser.webUSBSupported} />
              <Badge label="WebGL2" active={hw.browser.webGL2Supported} />
              <Badge label="Bluetooth" active={hw.browser.webBluetoothSupported} />
            </div>
            <Row label="Browser" value={`${hw.browser.name} ${hw.browser.version}`} />
            <Row label="Engine" value={hw.browser.engine} />
            {!hw.browser.webSerialSupported && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 8, padding: 10, marginTop: 10 }}>
                <p style={{ color: C.red, fontSize: 11, margin: 0 }}>⚠️ CNC ke liye Chrome ya Edge browser use karo — WebSerial API required hai</p>
              </div>
            )}
          </Card>

          <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>

            {/* CPU */}
            <Card title="CPU / Processor" icon={Cpu} color={C.blue}>
              <Row label="Logical Cores" value={`${hw.cpu.logicalCores} cores`} />
              <Row label="Performance Tier" value={hw.cpu.estimatedPerformance.toUpperCase()} />
              <div className="mt-2">
                <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(hw.cpu.logicalCores / 16 * 100, 100)}%`, background: perfColor(hw.cpu.estimatedPerformance), borderRadius: 4, transition: "width 1s" }} />
                </div>
              </div>
            </Card>

            {/* RAM */}
            <Card title="Memory (RAM)" icon={MemoryStick} color={C.green}>
              <Row
                label="Estimated RAM"
                value={hw.memory.estimatedGB !== null ? `${hw.memory.estimatedGB} GB` : "Access denied (privacy)"}
                ok={hw.memory.estimatedGB !== null ? hw.memory.estimatedGB >= 8 : null}
              />
              <Row label="Recommendation" value={hw.memory.estimatedGB !== null ? (hw.memory.estimatedGB >= 16 ? "Excellent for CNC" : hw.memory.estimatedGB >= 8 ? "Good" : "Upgrade recommended") : "Unknown"} />
            </Card>

            {/* GPU */}
            <Card title="GPU / Graphics" icon={Zap} color={C.purple}>
              <Row label="GPU Tier" value={hw.gpu.tier.toUpperCase()} />
              <Row label="Renderer" value={hw.gpu.unmaskedRenderer !== "Unknown" ? hw.gpu.unmaskedRenderer.slice(0, 40) : hw.gpu.renderer.slice(0, 40)} />
              <Row label="Vendor" value={hw.gpu.unmaskedVendor !== "Unknown" ? hw.gpu.unmaskedVendor : hw.gpu.vendor} />
              <Row label="Max Texture" value={`${hw.gpu.maxTextureSize}px`} />
              <Row label="GL Extensions" value={`${hw.gpu.extensions}`} />
              <div style={{ marginTop: 8 }}>
                <span style={{ color: tierColor(hw.gpu.tier), fontSize: 10, fontWeight: 700 }}>
                  {hw.gpu.tier === "dedicated" ? "🔥 Dedicated GPU — Simulation fast chalega!" : hw.gpu.tier === "integrated" ? "⚡ Integrated GPU — Theek hai" : "ℹ️ GPU tier unknown"}
                </span>
              </div>
            </Card>

            {/* Screen */}
            <Card title="Display / Screen" icon={Monitor} color={C.cyan}>
              <Row label="Resolution" value={`${hw.screen.width}×${hw.screen.height}`} />
              <Row label="Pixel Ratio" value={`${hw.screen.pixelRatio}x`} />
              <Row label="Color Depth" value={`${hw.screen.colorDepth}-bit`} />
              {hw.screen.refreshRate && <Row label="Refresh Rate" value={`~${hw.screen.refreshRate} Hz`} />}
            </Card>

            {/* Platform */}
            <Card title="System / Platform" icon={Activity} color={C.yellow}>
              <Row label="OS" value={hw.platform.os} />
              <Row label="Device Type" value={hw.platform.isDesktop ? "Desktop/Laptop" : hw.platform.isTablet ? "Tablet" : "Mobile"} />
              <Row label="Language" value={hw.platform.language} />
              <Row label="Internet" value={hw.platform.onLine ? "Online" : "Offline"} ok={hw.platform.onLine} />
              <Row label="Connection" value={hw.platform.connectionType.toUpperCase()} />
            </Card>

            {/* Battery */}
            {hw.battery && (
              <Card title="Battery" icon={Battery} color={hw.battery.charging ? C.green : hw.battery.level < 20 ? C.red : C.yellow}>
                <Row label="Level" value={`${hw.battery.level}%`} ok={hw.battery.level > 20} />
                <Row label="Status" value={hw.battery.charging ? "⚡ Charging" : "🔋 On Battery"} />
                {!hw.battery.charging && hw.battery.dischargingTime < Infinity && (
                  <Row label="Time Remaining" value={`${Math.round(hw.battery.dischargingTime / 60)} min`} />
                )}
                <div className="mt-2">
                  <div style={{ width: "100%", height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${hw.battery.level}%`, background: hw.battery.level > 50 ? C.green : hw.battery.level > 20 ? C.yellow : C.red, borderRadius: 5 }} />
                  </div>
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {/* CNC Serial Connection */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginTop: 20 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Usb size={16} style={{ color: serialConnected ? C.green : C.sub }} />
            <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>CNC Machine — Direct USB/Serial Connection</span>
            {serialConnected && <span style={{ background: "rgba(34,197,94,0.15)", color: C.green, borderRadius: 6, padding: "2px 8px", fontSize: 10 }}>CONNECTED</span>}
          </div>
          <div className="flex gap-2">
            {!serialConnected ? (
              <button
                onClick={connectSerial}
                disabled={!hw?.browser.webSerialSupported}
                style={{ background: hw?.browser.webSerialSupported ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${hw?.browser.webSerialSupported ? C.green : C.border}`, color: hw?.browser.webSerialSupported ? C.green : C.sub, borderRadius: 8, padding: "6px 12px", cursor: hw?.browser.webSerialSupported ? "pointer" : "not-allowed", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}
              >
                <Link size={12} /> Connect CNC
              </button>
            ) : (
              <button onClick={disconnectSerial} style={{ background: "rgba(239,68,68,0.15)", border: `1px solid ${C.red}`, color: C.red, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 11 }}>
                Disconnect
              </button>
            )}
          </div>
        </div>

        {!hw?.browser.webSerialSupported && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <p style={{ color: C.red, fontSize: 11, margin: 0 }}>⚠️ Chrome ya Edge browser use karo CNC connect karne ke liye (WebSerial API required)</p>
          </div>
        )}

        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={{ color: C.sub, fontSize: 11, display: "block", marginBottom: 6 }}>G-Code to Send</label>
            <textarea
              value={gcode}
              onChange={e => setGcode(e.target.value)}
              rows={6}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 11, resize: "vertical", fontFamily: "monospace", boxSizing: "border-box" }}
              placeholder="G28 ; Home\nG1 X10 Y10 F1000"
            />
            <button
              onClick={sendGCode}
              disabled={!serialConnected || sending}
              style={{ marginTop: 8, width: "100%", background: serialConnected ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${serialConnected ? C.blue : C.border}`, color: serialConnected ? C.blue : C.sub, borderRadius: 8, padding: "8px", cursor: serialConnected ? "pointer" : "not-allowed", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <Send size={12} />{sending ? "Bhejna..." : "G-Code Bhejo → CNC"}
            </button>
          </div>

          <div>
            <label style={{ color: C.sub, fontSize: 11, display: "block", marginBottom: 6 }}>Serial Terminal Log</label>
            <div
              ref={logRef}
              style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", height: 160, overflowY: "auto", fontSize: 10, color: C.green, fontFamily: "monospace" }}
            >
              {serialLog.length === 0 ? <span style={{ color: C.sub }}>CNC connect karo — messages yahan aayenge...</span> : serialLog.map((l, i) => <div key={i}>{l}</div>)}
            </div>
            <button onClick={() => setSerialLog([])} style={{ marginTop: 6, background: "transparent", border: `1px solid ${C.border}`, color: C.sub, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 10 }}>
              Log Clear
            </button>
          </div>
        </div>
      </div>

      {/* Server Hardware */}
      {serverHw && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} style={{ color: C.blue }} />
            <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>Server Hardware (AI Processing)</span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div>
              <Row label="CPU Model" value={serverHw.cpu?.brand || serverHw.cpuModel || "Unknown"} />
              <Row label="CPU Cores" value={`${serverHw.cpu?.cores || serverHw.cpuCores || "?"} cores`} />
              <Row label="CPU Load" value={`${serverHw.cpu?.currentLoad || serverHw.cpuUsage || 0}%`} />
            </div>
            <div>
              <Row label="Total RAM" value={`${((serverHw.memory?.total || serverHw.ram?.total || 0) / 1024 / 1024 / 1024).toFixed(1)} GB`} />
              <Row label="RAM Used" value={`${((serverHw.memory?.used || serverHw.ram?.used || 0) / 1024 / 1024 / 1024).toFixed(1)} GB`} />
              <Row label="Platform" value={serverHw.os?.platform || serverHw.platform || "cloud"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
