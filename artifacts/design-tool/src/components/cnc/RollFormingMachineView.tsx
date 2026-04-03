import { useRef, useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Station {
  x: number;
  topY: number;
  botY: number;
  rollR: number;
  bendAngle: number; // degrees — how much this station bends the strip
  label: string;
}

interface MachineState {
  speed: number;        // m/min (slider)
  material: string;
  running: boolean;
  piecesCount: number;
  totalMeters: number;
  cutTimer: number;     // seconds until next cut
  alarmStation: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MATERIALS: Record<string, { color: string; sheen: string; name: string; ys: number }> = {
  GI:   { color: "#c8d8c8", sheen: "#e8f4e8", name: "GI (Galvanized Steel)", ys: 280 },
  SS:   { color: "#d0d8e0", sheen: "#eef2f8", name: "Stainless Steel", ys: 310 },  // FIX: 520→310 MPa (annealed 2B supply, not 1/4-hard)
  AL:   { color: "#d0c890", sheen: "#ece8c0", name: "Aluminium", ys: 270 },        // FIX: 110→270 MPa (6061-T4 design value)
  CR:   { color: "#c0c8d0", sheen: "#dce4ec", name: "Cold Rolled (CR)", ys: 340 },  // FIX: was 250 (swapped with HR)
  HR:   { color: "#c8b880", sheen: "#e4d4a0", name: "Hot Rolled (HR)", ys: 250 },  // FIX: was 350 (swapped with CR)
  MS:   { color: "#b8c0c8", sheen: "#d4dce4", name: "Mild Steel", ys: 250 },       // FIX: 300→250 MPa (IS 2062 E250)
};

const STATION_COUNT = 9;

// ─── Canvas Renderer ──────────────────────────────────────────────────────────

function buildStations(cw: number, ch: number): Station[] {
  const startX = cw * 0.15;
  const endX = cw * 0.88;
  const midY = ch * 0.5;
  const gap = (endX - startX) / (STATION_COUNT - 1);
  const rollR = Math.min(26, ch * 0.055);
  const gap2 = rollR * 0.22; // strip gap between top & bot roll

  const maxBend = 85; // degrees total — C-channel profile
  // Bend progression: slow → fast → slow (ease in/out)
  const bendCurve = [0, 8, 18, 32, 48, 62, 72, 80, maxBend];

  return Array.from({ length: STATION_COUNT }, (_, i) => ({
    x: startX + i * gap,
    topY: midY - rollR - gap2,
    botY: midY + rollR + gap2,
    rollR,
    bendAngle: bendCurve[i],
    label: `ST-${String(i + 1).padStart(2, "0")}`,
  }));
}

function drawBackground(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  // Deep industrial dark gradient
  const bg = ctx.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, "#0a0e1a");
  bg.addColorStop(0.5, "#0d1220");
  bg.addColorStop(1, "#080c18");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);

  // Floor line
  ctx.save();
  ctx.strokeStyle = "rgba(255,200,80,0.12)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.moveTo(0, ch * 0.74);
  ctx.lineTo(cw, ch * 0.74);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Grid lines
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x < cw; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
  }
  for (let y = 0; y < ch; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
  }
  ctx.restore();
}

function drawCoil(
  ctx: CanvasRenderingContext2D,
  cw: number, ch: number,
  t: number,
  matColor: string, matSheen: string,
) {
  const cx = cw * 0.07;
  const cy = ch * 0.5;
  const R = ch * 0.14;

  // Base stand
  ctx.save();
  ctx.fillStyle = "#1a2030";
  ctx.beginPath();
  ctx.roundRect(cx - 20, cy + R - 4, 40, 30, 4);
  ctx.fill();
  ctx.fillStyle = "#2a3040";
  ctx.beginPath();
  ctx.roundRect(cx - 30, cy + R + 22, 60, 10, 3);
  ctx.fill();
  ctx.restore();

  // Coil layers (3 rings)
  for (let r = R; r > R * 0.35; r -= R * 0.12) {
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
    grad.addColorStop(0, matSheen);
    grad.addColorStop(0.6, matColor);
    grad.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, r - R * 0.1, 0, Math.PI * 2, true);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // Spinning spokes
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 1.2);
  ctx.strokeStyle = "rgba(180,180,200,0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, R * 0.55); ctx.stroke();
  }
  ctx.restore();

  // Hub
  const hubGrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 14);
  hubGrad.addColorStop(0, "#6080a0");
  hubGrad.addColorStop(1, "#203050");
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad; ctx.fill();
  ctx.strokeStyle = "#8090b0"; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  // Label
  ctx.save();
  ctx.fillStyle = "rgba(255,200,80,0.7)";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.fillText("UNCOILER", cx, cy + R + 44);
  ctx.restore();
}

function drawStrip(
  ctx: CanvasRenderingContext2D,
  stations: Station[],
  t: number,
  matColor: string, matSheen: string,
  cw: number, ch: number,
) {
  const midY = ch * 0.5;
  const stripH = Math.max(4, ch * 0.009);
  const coilX = cw * 0.07;
  const outX = cw * 0.94;

  // Build strip polyline — straight from coil to st1, then profile forms
  const pts: [number, number][] = [];
  pts.push([coilX + ch * 0.14, midY]);
  pts.push([stations[0].x - stations[0].rollR, midY]);

  // Through each station — strip center follows midY (flat in center)
  for (const st of stations) {
    pts.push([st.x, midY]);
  }
  pts.push([outX, midY]);

  // Animated offset for motion illusion
  const offset = (t * 80) % 30;

  // Draw strip shadow
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = stripH + 4;
  ctx.lineCap = "square";
  ctx.beginPath();
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y + 3) : ctx.lineTo(x, y + 3));
  ctx.stroke();
  ctx.restore();

  // Draw animated strip with metallic sheen
  const stripGrad = ctx.createLinearGradient(0, midY - stripH, 0, midY + stripH);
  stripGrad.addColorStop(0, matSheen);
  stripGrad.addColorStop(0.3, matColor);
  stripGrad.addColorStop(0.7, matColor);
  stripGrad.addColorStop(1, "rgba(0,0,0,0.2)");

  ctx.save();
  ctx.strokeStyle = stripGrad;
  ctx.lineWidth = stripH;
  ctx.lineCap = "square";
  ctx.beginPath();
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.stroke();

  // Animated motion dashes (speed indicator)
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.setLineDash([12, 18]);
  ctx.lineDashOffset = -offset;
  ctx.beginPath();
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Draw profile cross-sections at each station (the bend shape)
  stations.forEach((st, i) => {
    const bendRad = (st.bendAngle * Math.PI) / 180;
    const webW = 30; // web width (flat top)
    const flangeLen = Math.min(40, 12 + i * 3.5);
    const flangeY = Math.sin(bendRad) * flangeLen;
    const flangeX = Math.cos(bendRad) * flangeLen;
    const profX = st.x;
    const profY = midY;
    const thick = 2.5;

    ctx.save();
    ctx.strokeStyle = matSheen;
    ctx.lineWidth = thick;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(200,220,255,0.3)";
    ctx.shadowBlur = 4;

    // C-channel cross section (left view)
    ctx.beginPath();
    // top flange
    ctx.moveTo(profX - webW / 2 - flangeX, profY - flangeY - 4);
    ctx.lineTo(profX - webW / 2, profY - 4);
    // web (horizontal top)
    ctx.lineTo(profX + webW / 2, profY - 4);
    // right flange
    ctx.lineTo(profX + webW / 2 + flangeX, profY - flangeY - 4);
    ctx.stroke();

    // bottom mirror
    ctx.beginPath();
    ctx.moveTo(profX - webW / 2 - flangeX, profY + flangeY + 4);
    ctx.lineTo(profX - webW / 2, profY + 4);
    ctx.lineTo(profX + webW / 2, profY + 4);
    ctx.lineTo(profX + webW / 2 + flangeX, profY + flangeY + 4);
    ctx.stroke();

    ctx.restore();
  });
}

function drawStation(
  ctx: CanvasRenderingContext2D,
  st: Station,
  t: number,
  idx: number,
  isAlarm: boolean,
) {
  const { x, topY, botY, rollR } = st;
  const spinAngle = t * (2.5 + idx * 0.1);

  // Stand legs
  ctx.save();
  ctx.strokeStyle = "#2a3548";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  // top roller stand
  ctx.beginPath(); ctx.moveTo(x - 8, topY); ctx.lineTo(x - 8, topY - rollR - 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 8, topY); ctx.lineTo(x + 8, topY - rollR - 10); ctx.stroke();
  // bottom roller stand
  ctx.beginPath(); ctx.moveTo(x - 8, botY); ctx.lineTo(x - 8, botY + rollR + 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 8, botY); ctx.lineTo(x + 8, botY + rollR + 10); ctx.stroke();
  ctx.restore();

  // Draw a roller (top or bottom)
  const drawRoller = (cy: number) => {
    const grad = ctx.createRadialGradient(x - rollR * 0.3, cy - rollR * 0.3, rollR * 0.1, x, cy, rollR);
    if (isAlarm) {
      grad.addColorStop(0, "#ff8040");
      grad.addColorStop(0.6, "#cc4010");
      grad.addColorStop(1, "#802000");
    } else {
      grad.addColorStop(0, "#e8d080");
      grad.addColorStop(0.5, "#c8a030");
      grad.addColorStop(0.85, "#a07820");
      grad.addColorStop(1, "#604810");
    }

    ctx.save();
    ctx.shadowColor = isAlarm ? "rgba(255,80,0,0.5)" : "rgba(200,160,40,0.35)";
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, cy, rollR, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = isAlarm ? "#ff9060" : "#d4b050";
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    // Knurling lines (spinning)
    ctx.save();
    ctx.translate(x, cy);
    ctx.rotate(spinAngle * (cy < 400 ? 1 : -1));
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1.5;
    for (let a = 0; a < 8; a++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(0, rollR * 0.3); ctx.lineTo(0, rollR * 0.9); ctx.stroke();
    }
    ctx.restore();

    // Center bolt
    ctx.save();
    ctx.beginPath(); ctx.arc(x, cy, rollR * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = "#303848"; ctx.fill();
    ctx.strokeStyle = "#5060a0"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  };

  drawRoller(topY);
  drawRoller(botY);

  // Station label box
  ctx.save();
  ctx.fillStyle = isAlarm ? "rgba(200,40,10,0.8)" : "rgba(20,40,80,0.85)";
  ctx.beginPath();
  ctx.roundRect(x - 22, botY + rollR + 14, 44, 18, 4);
  ctx.fill();
  ctx.fillStyle = isAlarm ? "#ffaa80" : "rgba(255,200,80,0.85)";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillText(st.label, x, botY + rollR + 27);

  // Bend angle
  ctx.fillStyle = "rgba(120,180,255,0.7)";
  ctx.font = "8px monospace";
  ctx.fillText(`${st.bendAngle}°`, x, botY + rollR + 40);
  ctx.restore();
}

function drawOutputProfile(
  ctx: CanvasRenderingContext2D,
  cw: number, ch: number,
  t: number, piecesCount: number,
  matColor: string, matSheen: string,
) {
  const outX = cw * 0.92;
  const midY = ch * 0.5;
  const profileW = 60;
  const flangeLen = 32;
  const webH = 28;

  // Stack of finished pieces
  const stackCount = Math.min(piecesCount, 5);
  for (let i = stackCount - 1; i >= 0; i--) {
    const yOff = i * 5;
    const alpha = 0.3 + (0.7 * (stackCount - i) / stackCount);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = matSheen;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const sx = outX + 14 + i * 2;
    const sy = midY - webH / 2 - yOff;
    // C profile
    ctx.beginPath();
    ctx.moveTo(sx - flangeLen, sy);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx, sy + webH);
    ctx.lineTo(sx - flangeLen, sy + webH);
    ctx.stroke();
    ctx.restore();
  }

  // Moving cut piece animation
  const cutPhase = ((t * 0.5) % 1);
  if (cutPhase < 0.85) {
    const pieceX = outX + cutPhase * 80;
    ctx.save();
    ctx.strokeStyle = matSheen;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const sy = midY - webH / 2;
    ctx.beginPath();
    ctx.moveTo(pieceX - flangeLen, sy);
    ctx.lineTo(pieceX, sy);
    ctx.lineTo(pieceX, sy + webH);
    ctx.lineTo(pieceX - flangeLen, sy + webH);
    ctx.stroke();
    ctx.restore();
  }

  // Label
  ctx.save();
  ctx.fillStyle = "rgba(80,200,120,0.8)";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.fillText("OUTPUT", outX + 30, midY + webH / 2 + 50);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "9px monospace";
  ctx.fillText(`${piecesCount} PCS`, outX + 30, midY + webH / 2 + 62);
  ctx.restore();
}

function drawCutOff(
  ctx: CanvasRenderingContext2D,
  cw: number, ch: number,
  t: number,
) {
  const x = cw * 0.905;
  const midY = ch * 0.5;
  const bladeH = ch * 0.12;

  // Cut animation — blade drops every ~2s
  const phase = (t * 0.5) % 1;
  const bladeY = phase < 0.08
    ? midY - bladeH + (phase / 0.08) * bladeH * 2
    : midY - bladeH;

  // Frame
  ctx.save();
  ctx.fillStyle = "#1a2438";
  ctx.beginPath(); ctx.roundRect(x - 14, midY - bladeH - 30, 28, bladeH * 2 + 60, 4); ctx.fill();
  ctx.fillStyle = "#243050";
  ctx.beginPath(); ctx.roundRect(x - 16, midY - bladeH - 10, 32, 6, 2); ctx.fill();
  ctx.restore();

  // Blade
  ctx.save();
  ctx.fillStyle = phase < 0.08 ? "#ff8040" : "#607090";
  ctx.beginPath();
  ctx.moveTo(x - 10, bladeY);
  ctx.lineTo(x + 10, bladeY);
  ctx.lineTo(x + 6, bladeY + 18);
  ctx.lineTo(x - 6, bladeY + 18);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // Label
  ctx.save();
  ctx.fillStyle = "rgba(255,140,60,0.7)";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("CUT-OFF", x, midY + bladeH + 36);
  ctx.restore();
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  cw: number, ch: number,
  state: MachineState,
  matName: string,
) {
  // Top bar
  ctx.save();
  const barGrad = ctx.createLinearGradient(0, 0, cw, 0);
  barGrad.addColorStop(0, "rgba(10,20,40,0.95)");
  barGrad.addColorStop(0.5, "rgba(15,25,50,0.9)");
  barGrad.addColorStop(1, "rgba(10,20,40,0.95)");
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, cw, 36);
  ctx.strokeStyle = "rgba(255,180,40,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 36); ctx.lineTo(cw, 36); ctx.stroke();

  // Title
  ctx.fillStyle = "rgba(255,190,60,0.9)";
  ctx.font = "bold 13px 'Inter', monospace";
  ctx.textAlign = "left";
  ctx.fillText("SAI ROLOTECH — ROLL FORMING MACHINE", 20, 23);

  // Status pill
  ctx.fillStyle = state.running ? "rgba(40,180,80,0.2)" : "rgba(200,60,40,0.2)";
  ctx.beginPath(); ctx.roundRect(cw - 100, 8, 80, 20, 10); ctx.fill();
  ctx.fillStyle = state.running ? "#40e080" : "#ff6040";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.fillText(state.running ? "● RUNNING" : "■ STOPPED", cw - 60, 22);

  ctx.restore();

  // Bottom stats bar
  ctx.save();
  const botGrad = ctx.createLinearGradient(0, ch - 40, cw, ch - 40);
  botGrad.addColorStop(0, "rgba(10,20,40,0.95)");
  botGrad.addColorStop(1, "rgba(10,20,40,0.95)");
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, ch - 44, cw, 44);
  ctx.strokeStyle = "rgba(255,180,40,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, ch - 44); ctx.lineTo(cw, ch - 44); ctx.stroke();

  const stats = [
    { label: "LINE SPEED", val: `${state.speed.toFixed(1)} m/min`, col: "#60d0ff" },
    { label: "MATERIAL", val: matName.split(" ")[0], col: "#ffd060" },
    { label: "PIECES CUT", val: `${state.piecesCount}`, col: "#80ff80" },
    { label: "TOTAL OUTPUT", val: `${state.totalMeters.toFixed(1)} m`, col: "#ff9060" },
    { label: "STATIONS", val: `${STATION_COUNT} ACTIVE`, col: "#c080ff" },
  ];

  const colW = cw / stats.length;
  stats.forEach(({ label, val, col }, i) => {
    const sx = colW * i + colW / 2;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, sx, ch - 28);
    ctx.fillStyle = col;
    ctx.font = "bold 13px monospace";
    ctx.fillText(val, sx, ch - 11);
  });

  ctx.restore();
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function RollFormingMachineView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);
  const lastTimeRef = useRef(0);
  const stateRef = useRef<MachineState>({
    speed: 12,
    material: "GI",
    running: true,
    piecesCount: 0,
    totalMeters: 0,
    cutTimer: 4,
  } as MachineState & { alarmStation: null });

  const [uiState, setUiState] = useState({
    speed: 12,
    material: "GI",
    running: true,
    piecesCount: 0,
  });

  const syncUI = useCallback(() => {
    const s = stateRef.current;
    setUiState({ speed: s.speed, material: s.material, running: s.running, piecesCount: s.piecesCount });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stations: Station[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      stations = buildStations(canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      const s = stateRef.current;
      if (s.running) {
        tRef.current += dt;
        const metersPerSec = s.speed / 60;
        s.totalMeters += metersPerSec * dt;
        s.cutTimer -= dt;
        if (s.cutTimer <= 0) {
          s.piecesCount += 1;
          s.cutTimer = Math.max(1, 6 - s.speed * 0.25); // faster speed = more cuts
          syncUI();
        }
      }

      const t = tRef.current;
      const cw = canvas.width;
      const ch = canvas.height;
      const mat = MATERIALS[s.material] || MATERIALS.GI;

      ctx.clearRect(0, 0, cw, ch);
      drawBackground(ctx, cw, ch);
      drawCoil(ctx, cw, ch, t, mat.color, mat.sheen);
      drawStrip(ctx, stations, t, mat.color, mat.sheen, cw, ch);
      stations.forEach((st, i) => drawStation(ctx, st, t, i, i === (s as any).alarmStation));
      drawCutOff(ctx, cw, ch, t);
      drawOutputProfile(ctx, cw, ch, t, s.piecesCount, mat.color, mat.sheen);
      drawHUD(ctx, cw, ch, s, mat.name);

      animRef.current = requestAnimationFrame(frame);
    };

    lastTimeRef.current = performance.now();
    animRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [syncUI]);

  // Sync UI changes back to stateRef
  const setSpeed = (v: number) => {
    stateRef.current.speed = v;
    setUiState((p) => ({ ...p, speed: v }));
  };
  const setMaterial = (v: string) => {
    stateRef.current.material = v;
    setUiState((p) => ({ ...p, material: v }));
  };
  const toggleRun = () => {
    stateRef.current.running = !stateRef.current.running;
    setUiState((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => {
    stateRef.current.piecesCount = 0;
    stateRef.current.totalMeters = 0;
    stateRef.current.cutTimer = 4;
    tRef.current = 0;
    setUiState((p) => ({ ...p, piecesCount: 0 }));
  };

  return (
    <div className="flex flex-col h-full bg-[#080c18]">
      {/* Controls bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-[#0d1428] border-b border-amber-500/20 flex-shrink-0 flex-wrap">
        {/* Run / Stop */}
        <button
          onClick={toggleRun}
          className={`px-4 py-1.5 rounded text-xs font-bold tracking-wide transition-all ${
            uiState.running
              ? "bg-red-700/80 hover:bg-red-600 text-red-100 border border-red-500/40"
              : "bg-green-700/80 hover:bg-green-600 text-green-100 border border-green-500/40"
          }`}
        >
          {uiState.running ? "■ STOP" : "▶ START"}
        </button>

        {/* Reset */}
        <button
          onClick={reset}
          className="px-3 py-1.5 rounded text-xs font-bold tracking-wide bg-slate-700/80 hover:bg-slate-600 text-slate-200 border border-slate-500/40 transition-all"
        >
          ↺ RESET
        </button>

        {/* Speed slider */}
        <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-xs">
          <span className="text-amber-400/70 text-[10px] font-mono whitespace-nowrap">LINE SPEED</span>
          <input
            type="range" min={2} max={40} step={0.5}
            value={uiState.speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="flex-1 accent-amber-400 h-1.5"
          />
          <span className="text-amber-300 text-[11px] font-mono w-14 text-right">{uiState.speed.toFixed(1)} m/min</span>
        </div>

        {/* Material */}
        <div className="flex items-center gap-2">
          <span className="text-amber-400/70 text-[10px] font-mono">MATERIAL</span>
          <select
            value={uiState.material}
            onChange={(e) => setMaterial(e.target.value)}
            className="bg-[#1a2540] text-amber-200 text-xs border border-amber-500/30 rounded px-2 py-1 outline-none"
          >
            {Object.entries(MATERIALS).map(([k, v]) => (
              <option key={k} value={k}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Pieces counter */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-green-400/70 text-[10px] font-mono">PIECES</span>
          <span className="text-green-300 text-sm font-bold font-mono bg-green-900/30 px-2 py-0.5 rounded border border-green-500/30">
            {uiState.piecesCount}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: "block" }}
        />
      </div>
    </div>
  );
}
