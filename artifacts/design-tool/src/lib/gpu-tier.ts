export type GpuTier = "ultra" | "high" | "medium" | "low";

export type GpuType = "dedicated" | "integrated" | "unknown";

export interface GpuInfo {
  type: GpuType;
  renderer: string;
  vendor: string;
  estimatedVRAM_GB: number;
  brand: "nvidia" | "amd" | "intel" | "apple" | "unknown";
  model: string;
  webgl2: boolean;
  webgpu: boolean;
  maxTextureSize: number;
}

export interface QualitySettings {
  tier: GpuTier;
  gpuInfo: GpuInfo;
  shadowMapSize: number;
  antialias: boolean;
  pixelRatio: number;
  cylinderSegments: number;
  sphereSegments: number;
  fogDistance: [number, number];
  maxLights: number;
  enableShadows: boolean;
  profilePoints: number;
  stripUpdateFrequency: number;
  maxParticles: number;
  postProcessing: boolean;
  ssao: boolean;
  bloom: boolean;
  meshDensityMultiplier: number;
  maxTriangles: number;
  textureResolution: number;
  anisotropicFiltering: number;
}

const NVIDIA_VRAM_TABLE: Record<string, number> = {
  "rtx 4090": 24, "rtx 4080": 16, "rtx 4070 ti": 12, "rtx 4070": 12, "rtx 4060 ti": 8, "rtx 4060": 8,
  "rtx 3090": 24, "rtx 3080 ti": 12, "rtx 3080": 10, "rtx 3070 ti": 8, "rtx 3070": 8, "rtx 3060 ti": 8, "rtx 3060": 12, "rtx 3050": 8,
  "rtx 2080 ti": 11, "rtx 2080 super": 8, "rtx 2080": 8, "rtx 2070 super": 8, "rtx 2070": 8, "rtx 2060 super": 8, "rtx 2060": 6,
  "gtx 1660 ti": 6, "gtx 1660 super": 6, "gtx 1660": 6, "gtx 1650 super": 4, "gtx 1650": 4,
  "gtx 1080 ti": 11, "gtx 1080": 8, "gtx 1070 ti": 8, "gtx 1070": 8, "gtx 1060": 6, "gtx 1050 ti": 4, "gtx 1050": 2,
  "gtx 960": 4, "gtx 970": 4, "gtx 980": 4, "gtx 980 ti": 6,
  "gtx 750 ti": 2, "gtx 750": 1, "gt 1030": 2, "gt 730": 2,
  "quadro rtx": 16, "quadro p": 8, "quadro k": 4,
  "rtx a6000": 48, "rtx a5000": 24, "rtx a4000": 16, "rtx a2000": 6,
};

const AMD_VRAM_TABLE: Record<string, number> = {
  "rx 7900 xtx": 24, "rx 7900 xt": 20, "rx 7800 xt": 16, "rx 7700 xt": 12, "rx 7600": 8,
  "rx 6950 xt": 16, "rx 6900 xt": 16, "rx 6800 xt": 16, "rx 6800": 16, "rx 6700 xt": 12, "rx 6600 xt": 8, "rx 6600": 8, "rx 6500 xt": 4,
  "rx 5700 xt": 8, "rx 5700": 8, "rx 5600 xt": 6, "rx 5500 xt": 8,
  "rx 580": 8, "rx 570": 4, "rx 560": 4, "rx 550": 2, "rx 480": 8, "rx 470": 4,
  "radeon pro w": 16, "radeon pro 5": 8,
};

const INTEGRATED_KEYWORDS = [
  "intel", "uhd", "iris", "hd graphics", "hd 4", "hd 5", "hd 6",
  "radeon vega", "radeon graphics", "amd radeon(tm)",
  "mali", "adreno", "powervr", "vivante", "tegra",
];

const DEDICATED_NVIDIA_KEYWORDS = [
  "geforce", "gtx", "rtx", "quadro", "tesla", "titan",
  "nvidia", "geforce mx",
];

const DEDICATED_AMD_KEYWORDS = [
  "rx ", "rx5", "rx6", "rx7", "radeon pro w", "radeon pro 5",
  "radeon r9", "radeon r7", "radeon hd 7", "radeon hd 8",
  "firepro", "radeon rx",
];

function estimateVRAM(rendererLower: string): number {
  for (const [model, vram] of Object.entries(NVIDIA_VRAM_TABLE)) {
    if (rendererLower.includes(model)) return vram;
  }
  for (const [model, vram] of Object.entries(AMD_VRAM_TABLE)) {
    if (rendererLower.includes(model)) return vram;
  }
  if (rendererLower.includes("apple m4")) return 24;
  if (rendererLower.includes("apple m3 max")) return 40;
  if (rendererLower.includes("apple m3 pro")) return 18;
  if (rendererLower.includes("apple m3")) return 8;
  if (rendererLower.includes("apple m2 ultra")) return 76;
  if (rendererLower.includes("apple m2 max")) return 32;
  if (rendererLower.includes("apple m2 pro")) return 16;
  if (rendererLower.includes("apple m2")) return 8;
  if (rendererLower.includes("apple m1")) return 8;
  if (DEDICATED_NVIDIA_KEYWORDS.some(k => rendererLower.includes(k))) return 4;
  if (DEDICATED_AMD_KEYWORDS.some(k => rendererLower.includes(k))) return 4;
  return 1;
}

function detectGpuType(rendererLower: string, vendorLower: string): GpuType {
  if (DEDICATED_NVIDIA_KEYWORDS.some(k => rendererLower.includes(k)) && !rendererLower.includes("intel")) return "dedicated";
  if (DEDICATED_AMD_KEYWORDS.some(k => rendererLower.includes(k))) return "dedicated";
  if (rendererLower.includes("apple m")) return "dedicated";
  if (INTEGRATED_KEYWORDS.some(k => rendererLower.includes(k))) return "integrated";
  if (vendorLower.includes("nvidia")) return "dedicated";
  if (vendorLower.includes("ati") || vendorLower.includes("amd")) {
    if (INTEGRATED_KEYWORDS.some(k => rendererLower.includes(k))) return "integrated";
    return "dedicated";
  }
  return "unknown";
}

function detectBrand(rendererLower: string, vendorLower: string): "nvidia" | "amd" | "intel" | "apple" | "unknown" {
  if (rendererLower.includes("nvidia") || rendererLower.includes("geforce") || rendererLower.includes("quadro") || rendererLower.includes("tesla") || rendererLower.includes("rtx") || rendererLower.includes("gtx") || vendorLower.includes("nvidia")) return "nvidia";
  if (rendererLower.includes("radeon") || rendererLower.includes("rx ") || rendererLower.includes("firepro") || vendorLower.includes("ati") || vendorLower.includes("amd")) return "amd";
  if (rendererLower.includes("apple")) return "apple";
  if (rendererLower.includes("intel") || rendererLower.includes("uhd") || rendererLower.includes("iris") || vendorLower.includes("intel")) return "intel";
  return "unknown";
}

function extractModelName(rendererLower: string): string {
  const patterns = [
    /nvidia\s+(geforce\s+)?(.+?)(?:\s*\/|$)/i,
    /(geforce\s+(?:gtx|rtx|mx)\s*\d+(?:\s*\w+)?)/i,
    /(radeon\s+(?:rx|r[79]|hd|pro)\s*\w+(?:\s*\w+)?)/i,
    /(quadro\s+\w+(?:\s*\w+)?)/i,
    /(apple\s+m\d+(?:\s*\w+)?)/i,
    /(intel.*?(?:uhd|iris|hd)\s*(?:graphics\s*)?\d*)/i,
  ];
  for (const pat of patterns) {
    const match = rendererLower.match(pat);
    if (match) return match[1] || match[2] || match[0];
  }
  return rendererLower.slice(0, 40);
}

export function detectGpuInfo(): GpuInfo {
  const info: GpuInfo = {
    type: "unknown", renderer: "unknown", vendor: "unknown",
    estimatedVRAM_GB: 1, brand: "unknown", model: "unknown",
    webgl2: false, webgpu: "gpu" in navigator, maxTextureSize: 4096,
  };

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", {
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    }) || canvas.getContext("webgl", {
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    if (gl) {
      if (gl instanceof WebGL2RenderingContext) info.webgl2 = true;
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        info.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "unknown";
        info.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "unknown";
      } else {
        info.renderer = gl.getParameter(gl.RENDERER) || "unknown";
        info.vendor = gl.getParameter(gl.VENDOR) || "unknown";
      }
      info.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

      if (info.renderer === "unknown" || info.renderer === "WebKit WebGL") {
        const maxTex = info.maxTextureSize;
        const maxVerts = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
        const cores = navigator.hardwareConcurrency || 2;
        const devMem = (navigator as any).deviceMemory || 2;
        if (maxTex >= 16384 && cores >= 6 && devMem >= 8) {
          info.renderer = "dedicated-gpu (heuristic)";
          info.type = "dedicated";
          info.estimatedVRAM_GB = devMem >= 16 ? 6 : 4;
        } else if (maxTex >= 8192 && (cores >= 4 || devMem >= 4)) {
          info.renderer = "mid-range-gpu (heuristic)";
          info.type = maxVerts >= 32 ? "dedicated" : "integrated";
          info.estimatedVRAM_GB = 2;
        }
      }
    }
    canvas.remove();
  } catch {}

  const rLow = info.renderer.toLowerCase();
  const vLow = info.vendor.toLowerCase();
  if (info.type === "unknown") info.type = detectGpuType(rLow, vLow);
  info.brand = detectBrand(rLow, vLow);
  info.model = extractModelName(rLow);
  if (info.estimatedVRAM_GB <= 1) info.estimatedVRAM_GB = estimateVRAM(rLow);

  return info;
}

function tierFromGpuInfo(gpuInfo: GpuInfo): GpuTier {
  const { type, estimatedVRAM_GB, brand, maxTextureSize } = gpuInfo;
  const cores = navigator.hardwareConcurrency || 4;
  const rLow = gpuInfo.renderer.toLowerCase();

  const isSoftware = ["swiftshader", "llvmpipe", "mesa dri", "microsoft basic", "virtualbox", "vmware"].some(k => rLow.includes(k));
  if (isSoftware) return "low";

  if (type === "dedicated") {
    if (estimatedVRAM_GB >= 8 && maxTextureSize >= 16384 && cores >= 6) return "ultra";
    if (estimatedVRAM_GB >= 6 && maxTextureSize >= 8192) return "ultra";
    if (estimatedVRAM_GB >= 4) return "high";
    if (estimatedVRAM_GB >= 2) return "high";
    return "medium";
  }

  if (brand === "apple") {
    if (estimatedVRAM_GB >= 16) return "ultra";
    if (estimatedVRAM_GB >= 8) return "high";
    return "medium";
  }

  if (type === "integrated") {
    if (rLow.includes("iris xe") && cores >= 8) return "medium";
    if (maxTextureSize >= 8192 && cores >= 6) return "medium";
    return "low";
  }

  if (gpuInfo.webgpu && cores >= 8) return "high";
  if (maxTextureSize >= 16384 && cores >= 8) return "high";
  if (maxTextureSize >= 8192 && cores >= 4) return "medium";
  if (maxTextureSize < 2048) return "low";
  return "medium";
}

const QUALITY_PRESETS: Record<GpuTier, Omit<QualitySettings, "gpuInfo">> = {
  ultra: {
    tier: "ultra",
    shadowMapSize: 8192,
    antialias: true,
    pixelRatio: Math.min(window.devicePixelRatio, 4.0),
    cylinderSegments: 128,
    sphereSegments: 128,
    fogDistance: [100, 300],
    maxLights: 16,
    enableShadows: true,
    profilePoints: 96,
    stripUpdateFrequency: 1,
    maxParticles: 100000,
    postProcessing: true,
    ssao: true,
    bloom: true,
    meshDensityMultiplier: 6.0,
    maxTriangles: 1000000,
    textureResolution: 8192,
    anisotropicFiltering: 16,
  },
  high: {
    tier: "high",
    shadowMapSize: 4096,
    antialias: true,
    pixelRatio: Math.min(window.devicePixelRatio, 3.0),
    cylinderSegments: 64,
    sphereSegments: 64,
    fogDistance: [80, 200],
    maxLights: 12,
    enableShadows: true,
    profilePoints: 64,
    stripUpdateFrequency: 1,
    maxParticles: 50000,
    postProcessing: true,
    ssao: true,
    bloom: true,
    meshDensityMultiplier: 4.0,
    maxTriangles: 500000,
    textureResolution: 4096,
    anisotropicFiltering: 16,
  },
  medium: {
    tier: "medium",
    shadowMapSize: 1024,
    antialias: true,
    pixelRatio: Math.min(window.devicePixelRatio, 1.5),
    cylinderSegments: 24,
    sphereSegments: 24,
    fogDistance: [25, 60],
    maxLights: 4,
    enableShadows: true,
    profilePoints: 16,
    stripUpdateFrequency: 3,
    maxParticles: 1500,
    postProcessing: false,
    ssao: false,
    bloom: false,
    meshDensityMultiplier: 1.0,
    maxTriangles: 30000,
    textureResolution: 1024,
    anisotropicFiltering: 4,
  },
  low: {
    tier: "low",
    shadowMapSize: 512,
    antialias: false,
    pixelRatio: 1,
    cylinderSegments: 12,
    sphereSegments: 12,
    fogDistance: [15, 35],
    maxLights: 2,
    enableShadows: false,
    profilePoints: 10,
    stripUpdateFrequency: 6,
    maxParticles: 200,
    postProcessing: false,
    ssao: false,
    bloom: false,
    meshDensityMultiplier: 0.5,
    maxTriangles: 8000,
    textureResolution: 512,
    anisotropicFiltering: 1,
  },
};

let cachedTier: GpuTier | null = null;
let cachedGpuInfo: GpuInfo | null = null;

export function detectGpuTier(): GpuTier {
  if (cachedTier) return cachedTier;
  const gpuInfo = detectGpuInfo();
  cachedGpuInfo = gpuInfo;
  cachedTier = tierFromGpuInfo(gpuInfo);
  return cachedTier;
}

export function getGpuInfo(): GpuInfo {
  if (cachedGpuInfo) return cachedGpuInfo;
  cachedGpuInfo = detectGpuInfo();
  if (!cachedTier) cachedTier = tierFromGpuInfo(cachedGpuInfo);
  return cachedGpuInfo;
}

export function isDedicatedGPU(): boolean {
  const info = getGpuInfo();
  return info.type === "dedicated";
}

export function getEstimatedVRAM(): number {
  return getGpuInfo().estimatedVRAM_GB;
}

export function getQualitySettings(override?: GpuTier): QualitySettings {
  const gpuInfo = getGpuInfo();
  const tier = override ?? detectGpuTier();
  const preset = QUALITY_PRESETS[tier];

  if (gpuInfo.type === "dedicated" && !override) {
    const vram = gpuInfo.estimatedVRAM_GB;
    return {
      ...preset,
      gpuInfo,
      pixelRatio: Math.min(window.devicePixelRatio, 4.0),
      maxParticles: vram >= 8 ? 100000 : vram >= 4 ? 50000 : 20000,
      maxTriangles: vram >= 8 ? 1000000 : vram >= 4 ? 500000 : 200000,
      meshDensityMultiplier: vram >= 8 ? 6.0 : vram >= 4 ? 4.0 : 2.5,
      cylinderSegments: vram >= 8 ? 128 : vram >= 4 ? 64 : 48,
      sphereSegments: vram >= 8 ? 128 : vram >= 4 ? 64 : 48,
      profilePoints: vram >= 8 ? 96 : vram >= 4 ? 64 : 32,
      postProcessing: true,
      bloom: true,
      antialias: true,
      enableShadows: true,
      shadowMapSize: vram >= 8 ? 8192 : vram >= 4 ? 4096 : 2048,
      textureResolution: vram >= 8 ? 8192 : vram >= 4 ? 4096 : 2048,
      anisotropicFiltering: 16,
      ssao: vram >= 4,
      maxLights: vram >= 8 ? 16 : 12,
      fogDistance: [100, 300] as [number, number],
    };
  }
  if (gpuInfo.webgpu && !override) {
    return {
      ...preset,
      gpuInfo,
      pixelRatio: Math.min(window.devicePixelRatio, 3.0),
      maxParticles: Math.max(preset.maxParticles, 30000),
      maxTriangles: Math.max(preset.maxTriangles, 300000),
      postProcessing: true,
      bloom: true,
      antialias: true,
      enableShadows: true,
    };
  }

  return { ...preset, gpuInfo };
}

export function getGpuSummary(): string {
  const info = getGpuInfo();
  const tier = detectGpuTier();
  const typeLabel = info.type === "dedicated" ? "DEDICATED (External)" : info.type === "integrated" ? "Integrated (Motherboard)" : "Unknown";
  return `${info.brand.toUpperCase()} ${info.model} | ${typeLabel} | ~${info.estimatedVRAM_GB}GB VRAM | Tier: ${tier.toUpperCase()} | WebGL2: ${info.webgl2 ? "Yes" : "No"} | WebGPU: ${info.webgpu ? "Yes" : "No"}`;
}

export function resetGpuTierCache(): void {
  cachedTier = null;
  cachedGpuInfo = null;
}
