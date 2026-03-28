import{g as j,d as V,b as Z,i as $,a as q}from"./gpu-tier-CyCBcf0q.js";let k=null,u=[],y=[],i=[],f=0,b=0,W=0;const Y=`
const GAUSS_5 = [
  { z: -0.9061798, w: 0.2369269 },
  { z: -0.5384693, w: 0.4786287 },
  { z:  0.0000000, w: 0.5688889 },
  { z:  0.5384693, w: 0.4786287 },
  { z:  0.9061798, w: 0.2369269 },
];

const HARDENING = {
  GI: { K: 500, n: 0.20 }, CR: { K: 550, n: 0.22 }, HR: { K: 480, n: 0.18 },
  SS: { K: 1300, n: 0.45 }, AL: { K: 350, n: 0.23 }, MS: { K: 490, n: 0.19 },
  CU: { K: 320, n: 0.34 }, TI: { K: 1400, n: 0.14 }, HSLA: { K: 800, n: 0.12 },
  PP: { K: 500, n: 0.20 }, DP600: { K: 1000, n: 0.17 }, DP780: { K: 1200, n: 0.14 },
  TRIP780: { K: 1100, n: 0.22 }, DUPLEX: { K: 900, n: 0.30 }, INCONEL: { K: 1500, n: 0.40 },
  BRASS: { K: 530, n: 0.35 }, SPRING: { K: 1600, n: 0.08 }, NI200: { K: 600, n: 0.38 },
};

/**
 * FIX: MAT_PROPS corrections (DIN 6935 / ASTM):
 * - CR/HR yield strengths were SWAPPED (CR:250 should be 340, HR:350 should be 250) — CRITICAL
 * - AL yield 110→270 MPa (5052-H32 design value), kf 0.38→0.43
 * - TI kf 0.52→0.50, E 116→115 GPa
 * - CU kf 0.40→0.44
 * - PP ys 35/E 1500 (polypropylene) → 280/200000 (pre-painted steel in roll forming context)
 * - HSLA kf 0.50→0.45 (consistent with deep-accuracy-engine.ts)
 */
const MAT_PROPS = {
  GI:     { ys: 280, E: 200000, kf: 0.44, nu: 0.30 },
  CR:     { ys: 340, E: 200000, kf: 0.44, nu: 0.30 },  // FIX: was 250 (swapped with HR)
  HR:     { ys: 250, E: 200000, kf: 0.42, nu: 0.30 },  // FIX: was 350 (swapped with CR), kf 0.48→0.42
  SS:     { ys: 310, E: 193000, kf: 0.50, nu: 0.28 },  // FIX: yield 520→310 MPa (annealed 2B supply per EN 10088-2 / ASTM A240; 520 is 1/4-hard cold-worked state)
  AL:     { ys: 270, E: 69000,  kf: 0.43, nu: 0.33 },  // FIX: yield 110→270, kf 0.38→0.43
  MS:     { ys: 250, E: 200000, kf: 0.44, nu: 0.30 },  // FIX: kf 0.42→0.44 (DIN 6935 MS)
  CU:     { ys: 200, E: 117000, kf: 0.44, nu: 0.34 },  // FIX: kf 0.40→0.44
  TI:     { ys: 880, E: 115000, kf: 0.50, nu: 0.34 },  // FIX: kf 0.52→0.50, E 116→115
  PP:     { ys: 280, E: 200000, kf: 0.44, nu: 0.30 },  // FIX: PP=pre-painted steel, not polypropylene
  HSLA:   { ys: 550, E: 205000, kf: 0.45, nu: 0.30 },  // FIX: kf 0.50→0.45, E+5 GPa
  DP600:  { ys: 380, E: 210000, kf: 0.38, nu: 0.30 },  // FIX: kf 0.33→0.38 (AHSS roll forming guideline; DP600 K-factor typically 0.38–0.43)
  DP780: { ys: 490, E: 210000, kf: 0.36, nu: 0.30 },  // FIX: yield 500→490 (EN 10338 min), kf 0.31→0.36 (AHSS roll forming guideline SME/AISI)
  TRIP780: { ys: 500, E: 210000, kf: 0.36, nu: 0.30 },  // FIX: kf 0.32→0.36 (TRIP780 roll forming K-factor same as DP780; 0.32 underestimates neutral axis shift)
  DUPLEX: { ys: 500, E: 200000, kf: 0.44, nu: 0.30 },  // FIX: kf 0.38→0.44 (Duplex SS 2205 ≈ SS grade)
  INCONEL: { ys: 500, E: 205000, kf: 0.34, nu: 0.31 },
  BRASS: { ys: 150, E: 110000, kf: 0.44, nu: 0.34 },
  SPRING: { ys: 1200, E: 210000, kf: 0.28, nu: 0.29 },
  NI200: { ys: 150, E: 207000, kf: 0.44, nu: 0.31 },  // FIX: kf 0.40→0.44 (pure nickel, similar to CU/brass)
};

const MAT_SB = {
  GI: { r: 0.03, rv: 1.2, nv: 0.20 },
  CR: { r: 0.025, rv: 1.0, nv: 0.22 },
  HR: { r: 0.04, rv: 0.9, nv: 0.18 },
  SS: { r: 0.06, rv: 1.0, nv: 0.45 },
  AL: { r: 0.035, rv: 0.7, nv: 0.30 },
  MS: { r: 0.03, rv: 1.1, nv: 0.20 },
  CU: { r: 0.02, rv: 0.8, nv: 0.35 },
  TI: { r: 0.08, rv: 1.5, nv: 0.10 },
  PP: { r: 0.03, rv: 1.2, nv: 0.20 },
  HSLA: { r: 0.055, rv: 1.3, nv: 0.15 },
  DP600: { r: 0.065, rv: 0.9, nv: 0.17 },
  DP780: { r: 0.08, rv: 0.85, nv: 0.14 },
  TRIP780: { r: 0.07, rv: 0.95, nv: 0.22 },
  DUPLEX: { r: 0.065, rv: 1.1, nv: 0.30 },
  INCONEL: { r: 0.09, rv: 1.2, nv: 0.40 },
  BRASS: { r: 0.02, rv: 0.8, nv: 0.35 },
  SPRING: { r: 0.12, rv: 1.6, nv: 0.08 },
  NI200: { r: 0.04, rv: 0.9, nv: 0.38 },
};

function computeStressStrain(bd, mat, hardening, thickness, formingProgress, nu, layerFrac, bendZoneRadius) {
  const inBendZone = bd.dist < bendZoneRadius;
  const proximity = inBendZone ? Math.max(0, 1 - bd.dist / bendZoneRadius) : 0;
  const R_inner = Math.max(bd.R, 0.5);
  const angleDeg = Math.abs(bd.angle);
  const angleRad = (angleDeg * Math.PI) / 180;
  if (!inBendZone || angleDeg < 0.01) {
    return { strain: 0.0005 * formingProgress, stress: 0.0005 * formingProgress * mat.E / mat.ys, thickness: thickness, thinning: 0 };
  }
  const kappa = 1 / (R_inner + thickness / 2);
  const zLayer = (layerFrac - 0.5) * thickness;
  let iVM = 0, iStr = 0, iThin = 0;
  for (const gp of GAUSS_5) {
    const zG = (gp.z * thickness) / 2;
    const lw = 1.0 - 0.5 * Math.abs(zG - zLayer) / (thickness / 2);
    const exx = kappa * zG * (angleRad / (Math.PI / 2)) * proximity * formingProgress;
    const eyy = -nu * exx;
    const ezz = -(exx + eyy);
    const eEff = (2 / 3) * Math.sqrt((exx - eyy) ** 2 + (eyy - ezz) ** 2 + (ezz - exx) ** 2) * Math.SQRT2 / 2;
    const sf = hardening.K * Math.pow(Math.max(eEff, 1e-12), hardening.n);
    const yielded = sf >= mat.ys;
    const sigma = yielded ? sf : mat.E * Math.abs(exx);
    const sxx = Math.sign(exx) * sigma;
    const syy = nu * sxx;
    const vm = Math.sqrt(sxx ** 2 - sxx * syy + syy ** 2);
    iVM += vm * gp.w * lw;
    iStr += Math.abs(eEff) * gp.w * lw;
    iThin += Math.abs(ezz) * gp.w * lw;
  }
  const tw = GAUSS_5.reduce((s, gp) => s + gp.w, 0);
  const avgVM = iVM / tw;
  const avgStr = iStr / tw;
  const avgThin = iThin / tw;
  const thinRatio = Math.max(0.7, 1 - avgThin);
  return { strain: avgStr, stress: Math.min(avgVM / mat.ys, 1.8), thickness: thickness * thinRatio, thinning: 1 - thinRatio };
}

function generateMeshWorker(data) {
  const { station, bendPoints, materialType, thickness, totalStations, stationIdx, meshDensity } = data;
  if (!station || !station.segments) return { triangles: [], points: [] };
  const mat = MAT_PROPS[materialType] || MAT_PROPS.GI;
  const hardening = HARDENING[materialType] || HARDENING.GI;
  const safeT = Math.max(thickness, 0.1);
  const nu = mat.nu;
  const formingProgress = (stationIdx + 1) / totalStations;
  const triangles = [];
  const points = [];
  const segs = station.segments;
  const bendAngles = station.bendAngles || [];
  const bendZoneRadius = Math.max(safeT * 4, 8);
  const halfT = safeT * 2.5;
  const density = meshDensity || 6;
  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si];
    const dx = seg.endX - seg.startX;
    const dy = seg.endY - seg.startY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 0; i < density; i++) {
      const t0 = i / density;
      const t1 = (i + 1) / density;
      const x0 = seg.startX + t0 * dx;
      const y0 = seg.startY + t0 * dy;
      const x1 = seg.startX + t1 * dx;
      const y1 = seg.startY + t1 * dy;
      const closestBend = (px, py) => {
        let best = { dist: Infinity, R: safeT * 2, angle: 0 };
        if (bendPoints) {
          for (let bi = 0; bi < bendPoints.length; bi++) {
            const bp = bendPoints[bi];
            const d = Math.hypot(bp.x - px, bp.y - py);
            if (d < best.dist) best = { dist: d, R: Math.max(bp.radius || safeT * 2, 0.5), angle: bendAngles[bi] || 0 };
          }
        }
        return best;
      };
      const b0 = closestBend(x0, y0);
      const b1 = closestBend(x1, y1);
      const o0 = computeStressStrain(b0, mat, hardening, safeT, formingProgress, nu, 1.0, bendZoneRadius);
      const o1 = computeStressStrain(b1, mat, hardening, safeT, formingProgress, nu, 1.0, bendZoneRadius);
      const i0 = computeStressStrain(b0, mat, hardening, safeT, formingProgress, nu, 0.0, bendZoneRadius);
      const i1 = computeStressStrain(b1, mat, hardening, safeT, formingProgress, nu, 0.0, bendZoneRadius);
      triangles.push(
        { x1: x0 + nx * halfT, y1: y0 + ny * halfT, x2: x1 + nx * halfT, y2: y1 + ny * halfT, x3: x1 - nx * halfT, y3: y1 - ny * halfT, stress: (o0.stress + o1.stress) / 2, strain: (o0.strain + o1.strain) / 2, thinning: (o0.thinning + o1.thinning) / 2 },
        { x1: x0 + nx * halfT, y1: y0 + ny * halfT, x2: x1 - nx * halfT, y2: y1 - ny * halfT, x3: x0 - nx * halfT, y3: y0 - ny * halfT, stress: (i0.stress + i1.stress) / 2, strain: (i0.strain + i1.strain) / 2, thinning: (i0.thinning + i1.thinning) / 2 }
      );
      const mid = computeStressStrain(b0.dist < b1.dist ? b0 : b1, mat, hardening, safeT, formingProgress, nu, 0.5, bendZoneRadius);
      points.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, vonMises: mid.stress, strainX: mid.strain, strainY: mid.strain * nu, thickness: mid.thickness });
    }
  }
  return { triangles, points };
}

function computeSpringbackWorker(data) {
  const { stations, materialType, thickness, bendRadius } = data;
  const mat = MAT_SB[materialType] || MAT_SB.GI;
  return stations.map((st, idx) => {
    const maxAngle = Math.max(...(st.bendAngles && st.bendAngles.length ? st.bendAngles : [0]));
    const rOverT = bendRadius / Math.max(thickness, 0.1);
    const effectiveRatio = mat.r * (1 + (rOverT - 2) * 0.01) * (1 + (1 - thickness) * 0.05) * (1 + (mat.rv - 1) * 0.02) * (1 - mat.nv * 0.1);
    const springbackAngle = maxAngle * effectiveRatio;
    return { stationNumber: idx + 1, originalAngle: maxAngle, springbackAngle, compensatedAngle: maxAngle + springbackAngle, springbackRatio: effectiveRatio };
  });
}

function computeFormingForceWorker(data) {
  const { segments, materialType, thickness, rollDiameter } = data;
  const mat = MAT_PROPS[materialType] || MAT_PROPS.GI;
  const safeT = Math.max(thickness, 0.1);
  const totalWidth = segments.reduce((sum, seg) => sum + Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY), 0);
  const R = (rollDiameter || 150) / 2;
  const mu = 0.12;
  const contactArc = Math.sqrt(R * safeT * 0.01);
  const force = (mat.ys * safeT * safeT * totalWidth) / (2 * Math.max(R, 1)) * (1 + mu * contactArc / safeT);
  const torque = force * R / 1000;
  const power = (force * 2 * Math.PI * R * 0.001) / 60;
  return { formingForceN: force, torqueNm: torque, powerKW: power, totalWidthMm: totalWidth, contactArcMm: contactArc, frictionCoeff: mu };
}

function computeBatchStressWorker(data) {
  const { stationIndices, stations, bendPoints, materialType, thickness, totalStations, meshDensity } = data;
  const results = {};
  for (const idx of stationIndices) {
    results[idx] = generateMeshWorker({ station: stations[idx], bendPoints, materialType, thickness, totalStations, stationIdx: idx, meshDensity });
  }
  return results;
}

self.onmessage = function(e) {
  const { id, type, data } = e.data;
  const start = performance.now();
  let result;
  try {
    switch (type) {
      case "mesh": result = generateMeshWorker(data); break;
      case "springback": result = computeSpringbackWorker(data); break;
      case "forming-force": result = computeFormingForceWorker(data); break;
      case "batch-stress": result = computeBatchStressWorker(data); break;
      default: throw new Error("Unknown task: " + type);
    }
    self.postMessage({ id, type: "result", data: result, computeTimeMs: performance.now() - start });
  } catch (err) {
    self.postMessage({ id, type: "error", error: err.message || String(err) });
  }
};
`;function z(){if(k)return k;const e=navigator.hardwareConcurrency||4,s=e,t=e>=8?"fast":e>=4?"medium":"slow",n=j(),r=V();Z();const a=$(),o=q();let l=4,c=16,R=!1,E=!1;try{const B=document.createElement("canvas"),p=B.getContext("webgl2");p&&(l=p.getParameter(p.MAX_DRAW_BUFFERS),c=p.getParameter(p.MAX_VERTEX_ATTRIBS),R=!!p.getExtension("EXT_color_buffer_float"),E=!0),B.remove()}catch{}const M=navigator.deviceMemory||4,m=performance.memory,v=m?Math.round(m.jsHeapSizeLimit/1048576):2048,I=m?Math.round(m.usedJSHeapSize/1048576):0,C=m?Math.round(m.totalJSHeapSize/1048576):0,G=v>0?Math.round((1-I/v)*100):80,X=typeof SharedArrayBuffer<"u",A=typeof OffscreenCanvas<"u",N=typeof MessageChannel<"u",_=Math.max(1,e-1),D=navigator.connection,L=D?.effectiveType||"unknown",F=D?.saveData||!1;let d;a&&o>=4||r==="ultra"||r==="high"&&e>=6&&M>=8?d="ultra":r!=="low"&&e>=4&&M>=4?d="high":e>=2&&M>=2?d="medium":d="low";const O={ultra:16,high:10,medium:6,low:4},K={ultra:2e5,high:1e5,medium:3e4,low:8e3},U={ultra:8,high:6,medium:2,low:1};let g=O[d],h=K[d],x=U[d];return a&&o>=4&&(g=Math.max(g,14),h=Math.max(h,15e4),x=Math.max(x,6)),a&&o>=6&&(g=Math.max(g,18),h=Math.max(h,2e5),x=Math.max(x,8)),k={cpu:{cores:e,logicalProcessors:s,estimatedSpeed:t},gpu:{renderer:n.renderer,vendor:n.vendor,tier:r,maxTextureSize:n.maxTextureSize,webgl2:n.webgl2,webgpu:n.webgpu,maxDrawBuffers:l,maxVertexAttribs:c,floatTextures:R,instancing:E,isDedicated:a,estimatedVRAM_GB:o,brand:n.brand,model:n.model},memory:{deviceMemoryGB:M,jsHeapLimitMB:v,jsHeapUsedMB:I,jsHeapTotalMB:C,availablePercent:G},workers:{maxWorkers:_,activeWorkers:0,supportsSharedArrayBuffer:X,supportsOffscreenCanvas:A,supportsTransferable:N},performance:{connectionType:L,saveData:F,hardwareConcurrency:e,touchDevice:"ontouchstart"in window,pixelRatio:window.devicePixelRatio||1},recommended:{workerPoolSize:_,meshDensity:g,maxTriangles:h,useOffscreen:A,batchSize:x,simulationQuality:d}},console.log(`[Hardware] GPU: ${n.renderer} | ${a?"DEDICATED":"Integrated"} | ~${o}GB VRAM | Tier: ${r} | Quality: ${d} | Mesh: ${g} | MaxTri: ${h}`),k}function Q(e){H();const s=new Blob([Y],{type:"application/javascript"}),t=URL.createObjectURL(s);for(let n=0;n<e;n++){const r=new Worker(t);r.onmessage=a=>J(n,a),r.onerror=a=>{console.error(`[HW Worker ${n}] Error:`,a),y[n]=!1,f=Math.max(0,f-1);const o=S.get(n);if(o){S.delete(n);const l=i.findIndex(c=>c.id===o);l>=0&&i.splice(l,1)[0].reject(new Error("Worker error: "+(a.message||"Unknown")))}w()},u.push(r),y.push(!1)}URL.revokeObjectURL(t)}const S=new Map;function J(e,s){const{id:t,type:n,data:r,error:a,computeTimeMs:o}=s.data;y[e]=!1,f=Math.max(0,f-1),S.delete(e);const l=i.findIndex(c=>c.id===t);if(l>=0){const c=i.splice(l,1)[0];n==="result"?(b++,W+=o||0,c.resolve(r)):c.reject(new Error(a||"Worker computation failed"))}w()}function w(){for(let e=0;e<u.length;e++)if(!y[e]&&i.length>0){const s=i.find(t=>!t.sent);s&&(s.sent=!0,y[e]=!0,f++,S.set(e,s.id),u[e].postMessage({id:s.id,type:s.type,data:s.payload}))}}function H(){u.forEach(e=>e.terminate()),u=[],y=[],f=0,S.clear();for(const e of i)e.reject(new Error("Worker pool terminated"));i=[]}let ee=0;function T(e,s){return new Promise((t,n)=>{const r=`hw-${++ee}-${Date.now()}`;i.push({id:r,type:e,payload:s,resolve:t,reject:n}),w()})}function ne(){return z()}function P(){if(u.length===0){const e=z();Q(e.recommended.workerPoolSize)}}function se(){return{poolSize:u.length,active:f,queued:i.filter(e=>!e.sent).length,totalProcessed:b,avgComputeMs:b>0?Math.round(W/b):0}}async function re(e,s,t,n,r,a,o){return P(),T("mesh",{station:e,bendPoints:s,materialType:t,thickness:n,totalStations:r,stationIdx:a,meshDensity:o})}async function ae(e,s,t,n){return P(),T("springback",{stations:e,materialType:s,thickness:t,bendRadius:n})}async function oe(e,s,t,n){return P(),T("forming-force",{segments:e,materialType:s,thickness:t,rollDiameter:n})}async function ie(e,s,t,n,r,a,o){return P(),T("batch-stress",{stationIndices:e,stations:s,bendPoints:t,materialType:n,thickness:r,totalStations:a,meshDensity:o})}function ce(){H(),i=[]}function de(){const e=performance.memory;return e?{usedMB:Math.round(e.usedJSHeapSize/1048576),totalMB:Math.round(e.totalJSHeapSize/1048576),limitMB:Math.round(e.jsHeapSizeLimit/1048576),percent:Math.round(e.usedJSHeapSize/e.jsHeapSizeLimit*100)}:{usedMB:0,totalMB:0,limitMB:0,percent:0}}function le(){const e=k,s=e?.gpu.isDedicated??!1,t=e?.gpu.tier??"medium";return{dpr:window.devicePixelRatio??1,shadows:t==="low"?"basic":"soft",shadowMapSize:t==="ultra"?4096:t==="high"?2048:1024,powerPreference:s?"high-performance":"default",toneMappingExposure:s?1.4:1.1}}async function ue(){try{if("storage"in navigator&&"persist"in navigator.storage){const e=await navigator.storage.persist();return e&&console.log("[HW] Persistent storage granted — IndexedDB / Cache not auto-evicted"),e}}catch{}return!1}function fe(e){if(["EXT_texture_filter_anisotropic","EXT_color_buffer_float","EXT_color_buffer_half_float","OES_texture_float","OES_texture_float_linear","OES_texture_half_float","OES_texture_half_float_linear","WEBGL_compressed_texture_s3tc","WEBGL_compressed_texture_etc","WEBGL_compressed_texture_bptc","EXT_disjoint_timer_query_webgl2","KHR_parallel_shader_compile","OVR_multiview2"].forEach(t=>{try{e.getExtension(t)}catch{}}),"hint"in e){const t=e;t.hint(t.GENERATE_MIPMAP_HINT,t.NICEST);try{t.hint(t.FRAGMENT_SHADER_DERIVATIVE_HINT,t.NICEST)}catch{}}}export{fe as activateAllWebGLExtensions,ie as computeBatchStressOnWorker,oe as computeFormingForceOnWorker,re as computeMeshOnWorker,ae as computeSpringbackOnWorker,ce as destroyWorkerPool,P as ensureWorkerPool,le as getCanvasProps,ne as getHardwareCapabilities,de as getMemorySnapshot,se as getWorkerStats,ue as requestPersistentStorage};
