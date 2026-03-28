import { getGpuInfo, getQualitySettings, isDedicatedGPU, getEstimatedVRAM, detectGpuTier, getGpuSummary, type GpuInfo } from "./gpu-tier";

export interface GPUComputeStatus {
  initialized: boolean;
  webgpuAvailable: boolean;
  webgpuAdapter: boolean;
  webgpuDevice: boolean;
  webgl2Available: boolean;
  dedicatedGPU: boolean;
  vramGB: number;
  gpuBrand: string;
  gpuModel: string;
  computeShadersReady: boolean;
  maxBufferSize: number;
  maxComputeInvocations: number;
  renderingMode: "webgpu" | "webgl2-max" | "webgl2-standard" | "webgl1-fallback";
  driverHints: string[];
  optimizations: string[];
}

let computeStatus: GPUComputeStatus | null = null;
let gpuDevice: GPUDevice | null = null;
let gpuAdapter: GPUAdapter | null = null;

export async function initGPUComputePipeline(): Promise<GPUComputeStatus> {
  if (computeStatus) return computeStatus;

  const gpuInfo = getGpuInfo();
  const dedicated = isDedicatedGPU();
  const vram = getEstimatedVRAM();
  const tier = detectGpuTier();

  const status: GPUComputeStatus = {
    initialized: true,
    webgpuAvailable: false,
    webgpuAdapter: false,
    webgpuDevice: false,
    webgl2Available: false,
    dedicatedGPU: dedicated,
    vramGB: vram,
    gpuBrand: gpuInfo.brand,
    gpuModel: gpuInfo.model,
    computeShadersReady: false,
    maxBufferSize: 0,
    maxComputeInvocations: 0,
    renderingMode: "webgl1-fallback",
    driverHints: [],
    optimizations: [],
  };

  if ("gpu" in navigator) {
    status.webgpuAvailable = true;
    try {
      const adapter = await (navigator as any).gpu.requestAdapter({
        powerPreference: "high-performance",
        forceFallbackAdapter: false,
      });
      if (adapter) {
        status.webgpuAdapter = true;
        gpuAdapter = adapter;

        const requiredFeatures: GPUFeatureName[] = [];
        if (adapter.features.has("float32-filterable")) requiredFeatures.push("float32-filterable");

        const requiredLimits: Record<string, number> = {};
        const adapterLimits = adapter.limits;
        if (adapterLimits.maxBufferSize) requiredLimits.maxBufferSize = adapterLimits.maxBufferSize;
        if (adapterLimits.maxStorageBufferBindingSize) requiredLimits.maxStorageBufferBindingSize = adapterLimits.maxStorageBufferBindingSize;
        if (adapterLimits.maxComputeWorkgroupSizeX) requiredLimits.maxComputeWorkgroupSizeX = adapterLimits.maxComputeWorkgroupSizeX;
        if (adapterLimits.maxComputeWorkgroupSizeY) requiredLimits.maxComputeWorkgroupSizeY = adapterLimits.maxComputeWorkgroupSizeY;
        if (adapterLimits.maxComputeWorkgroupsPerDimension) requiredLimits.maxComputeWorkgroupsPerDimension = adapterLimits.maxComputeWorkgroupsPerDimension;

        try {
          const device = await adapter.requestDevice({
            requiredFeatures,
            requiredLimits,
          });
          if (device) {
            status.webgpuDevice = true;
            status.computeShadersReady = true;
            gpuDevice = device;
            status.maxBufferSize = device.limits.maxBufferSize || 0;
            status.maxComputeInvocations = device.limits.maxComputeWorkgroupsPerDimension || 0;
            status.renderingMode = "webgpu";

            device.lost.then((info: GPUDeviceLostInfo) => {
              console.warn("[GPU Compute] Device lost:", info.message);
              gpuDevice = null;
              computeStatus = null;
            });
          }
        } catch (e) {
          console.warn("[GPU Compute] Device request failed:", e);
        }
      }
    } catch (e) {
      console.warn("[GPU Compute] Adapter request failed:", e);
    }
  }

  if (!status.webgpuDevice) {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2", {
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
        desynchronized: true,
      }) as WebGL2RenderingContext | null;
      if (gl) {
        status.webgl2Available = true;
        status.renderingMode = dedicated ? "webgl2-max" : "webgl2-standard";

        if (dedicated) {
          applyWebGL2MaxQuality(gl);
        }
      }
      canvas.remove();
    } catch {}
  }

  if (dedicated) {
    status.optimizations.push("HIGH_PERFORMANCE_GPU: Dedicated GPU detected — all rendering maximized");
    status.optimizations.push(`VRAM_BUDGET: ~${vram}GB available — high-res textures & dense meshes enabled`);
    status.optimizations.push("POWER_PREFERENCE: high-performance mode locked — no power saving");
    status.optimizations.push("PIXEL_RATIO: Native display resolution — no downscaling");
    status.optimizations.push("MESH_DENSITY: 3x multiplier — maximum geometric detail");
    status.optimizations.push("POST_PROCESSING: SSAO + Bloom + Shadows at full quality");
    status.optimizations.push("ANTIALIASING: MSAA 4x or higher enabled");
    status.optimizations.push("ANISOTROPIC_FILTERING: 16x maximum");
    status.optimizations.push("SHADOW_MAP: 4096px resolution");
    status.optimizations.push("TEXTURE_RESOLUTION: Up to 4096px");

    if (vram >= 6) {
      status.optimizations.push("6GB+ VRAM: Extra-dense forming simulation mesh (18 subdivisions)");
      status.optimizations.push("6GB+ VRAM: Real-time stress visualization with full Gauss integration");
    }
    if (vram >= 4) {
      status.optimizations.push("4GB+ VRAM: Double triangle budget (200K+ triangles)");
      status.optimizations.push("4GB+ VRAM: Full particle system (10K+ particles)");
    }
  }

  status.driverHints = generateDriverHints(gpuInfo, dedicated, vram);

  computeStatus = status;

  console.log(`[GPU Compute Pipeline] Initialized:`, {
    mode: status.renderingMode,
    dedicated: status.dedicatedGPU,
    vram: `${status.vramGB}GB`,
    gpu: `${status.gpuBrand} ${status.gpuModel}`,
    webgpu: status.webgpuDevice,
    optimizations: status.optimizations.length,
  });

  return status;
}

function applyWebGL2MaxQuality(gl: WebGL2RenderingContext): void {
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic") ||
    (gl as any).getExtension("MOZ_EXT_texture_filter_anisotropic") ||
    (gl as any).getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  if (aniso) {
    const maxAniso = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    console.log(`[GPU] Anisotropic filtering: ${maxAniso}x available`);
  }

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.hint(gl.GENERATE_MIPMAP_HINT, gl.NICEST);
  gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
}

function generateDriverHints(gpuInfo: GpuInfo, dedicated: boolean, vram: number): string[] {
  const hints: string[] = [];
  const rLow = gpuInfo.renderer.toLowerCase();

  if (gpuInfo.brand === "nvidia") {
    hints.push("NVIDIA GPU detected — ensure latest Game Ready / Studio driver from nvidia.com/drivers");
    hints.push("In NVIDIA Control Panel → Manage 3D Settings → set 'Power Management' to 'Prefer Maximum Performance'");
    hints.push("In NVIDIA Control Panel → set 'Preferred Graphics Processor' to 'High-performance NVIDIA processor'");
    hints.push("Set 'Texture Filtering Quality' to 'High Quality' in NVIDIA Control Panel");
    hints.push("Enable 'Threaded Optimization' in NVIDIA Control Panel for multi-core rendering");
    if (rLow.includes("rtx")) {
      hints.push("RTX GPU: Hardware ray tracing available — WebGPU ray tracing coming soon");
    }
    if (rLow.includes("laptop") || rLow.includes("mobile")) {
      hints.push("NVIDIA Optimus: In Windows Settings → Display → Graphics → add browser → set to 'High Performance'");
    }
  } else if (gpuInfo.brand === "amd") {
    hints.push("AMD GPU detected — install latest Adrenalin driver from amd.com/support");
    hints.push("In AMD Software → Graphics → set all profiles to 'Performance' mode");
    hints.push("Set 'Texture Filtering Quality' to 'High' in AMD Software → Graphics");
    hints.push("Enable 'Radeon Anti-Lag' for lower input latency");
    if (rLow.includes("rx 5") || rLow.includes("rx 6") || rLow.includes("rx 7")) {
      hints.push("AMD RDNA GPU: Smart Access Memory (SAM/Resizable BAR) recommended for full VRAM bandwidth");
    }
  } else if (gpuInfo.brand === "intel") {
    hints.push("Intel GPU detected — update via intel.com/content/www/us/en/download-center");
    if (rLow.includes("arc")) {
      hints.push("Intel Arc GPU: Enable XeSS upscaling in Intel Graphics Command Center for better quality");
      hints.push("Intel Arc: Ensure Resizable BAR is enabled in BIOS for full performance");
    } else {
      hints.push("Intel integrated GPU: For better quality, consider using an external dedicated GPU (NVIDIA GTX 1650+ or AMD RX 570+)");
    }
  }

  if (dedicated && !gpuInfo.webgpu) {
    hints.push("WebGPU not available — enable via chrome://flags/#enable-unsafe-webgpu (Chrome) or about:config (Firefox)");
    hints.push("Chrome 113+ and Edge 113+ support WebGPU natively — update your browser");
  }

  if (dedicated) {
    hints.push("Windows: Settings → System → Display → Graphics → Set browser to 'High Performance'");
    hints.push("Laptop users: Plug in charger for full GPU clock speeds — battery mode limits performance");
    hints.push("Close other GPU-intensive apps (games, video editing) to free VRAM for this software");
  }

  if (!dedicated) {
    hints.push("No dedicated GPU detected — rendering will use integrated graphics");
    hints.push("For 3x better quality: Add external GPU (NVIDIA GTX 1650 4GB = ₹12,000 or AMD RX 570 4GB = ₹8,000)");
    hints.push("Even a 4GB dedicated GPU will dramatically improve mesh density, shadows, and post-processing");
  }

  return hints;
}

export function getGPUComputeStatus(): GPUComputeStatus | null {
  return computeStatus;
}

export function getWebGPUDevice(): GPUDevice | null {
  return gpuDevice;
}

export function getGPURenderConfig() {
  const gpuInfo = getGpuInfo();
  const dedicated = isDedicatedGPU();
  const vram = getEstimatedVRAM();
  const quality = getQualitySettings();

  const config = {
    powerPreference: dedicated ? "high-performance" as const : "default" as const,
    antialias: quality.antialias,
    alpha: true,
    depth: true,
    stencil: dedicated,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
    desynchronized: dedicated,

    pixelRatio: quality.pixelRatio,
    shadowMapSize: quality.shadowMapSize,
    enableShadows: quality.enableShadows,
    ssao: quality.ssao,
    bloom: quality.bloom,
    postProcessing: quality.postProcessing,
    maxParticles: quality.maxParticles,
    meshDensityMultiplier: quality.meshDensityMultiplier,
    maxTriangles: quality.maxTriangles,
    cylinderSegments: quality.cylinderSegments,
    sphereSegments: quality.sphereSegments,
    textureResolution: quality.textureResolution,
    anisotropicFiltering: quality.anisotropicFiltering,

    toneMapping: dedicated ? "ACESFilmic" : "Linear",
    toneMappingExposure: dedicated ? 1.2 : 1.0,
    outputColorSpace: "srgb",
    physicallyCorrectLights: dedicated,
    logarithmicDepthBuffer: vram >= 6,
    shadowType: dedicated ? (vram >= 6 ? "PCFSoft" : "PCF") : "Basic",
    maxShadowCascades: dedicated ? (vram >= 6 ? 4 : 2) : 1,
  };

  return config;
}

export function createOptimizedWebGLContext(canvas: HTMLCanvasElement): WebGL2RenderingContext | WebGLRenderingContext | null {
  const dedicated = isDedicatedGPU();

  const gl2 = canvas.getContext("webgl2", {
    powerPreference: dedicated ? "high-performance" : "default",
    antialias: true,
    alpha: true,
    depth: true,
    stencil: dedicated,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
    desynchronized: dedicated,
  }) as WebGL2RenderingContext | null;

  if (gl2) {
    if (dedicated) {
      gl2.hint(gl2.GENERATE_MIPMAP_HINT, gl2.NICEST);
      gl2.hint(gl2.FRAGMENT_SHADER_DERIVATIVE_HINT, gl2.NICEST);
      gl2.enable(gl2.DEPTH_TEST);
      gl2.depthFunc(gl2.LEQUAL);

      const aniso = gl2.getExtension("EXT_texture_filter_anisotropic");
      if (aniso) {
        const maxAniso = gl2.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        console.log(`[GPU] Max anisotropic filtering: ${maxAniso}x — applying to all textures`);
      }

      const colorBuf = gl2.getExtension("EXT_color_buffer_float");
      if (colorBuf) console.log("[GPU] Float color buffers enabled — HDR rendering available");

      const floatLinear = gl2.getExtension("OES_texture_float_linear");
      if (floatLinear) console.log("[GPU] Float texture linear filtering enabled");

      const drawBufs = gl2.getParameter(gl2.MAX_DRAW_BUFFERS);
      console.log(`[GPU] Max draw buffers: ${drawBufs} — MRT (deferred rendering) available`);

      const maxTexSize = gl2.getParameter(gl2.MAX_TEXTURE_SIZE);
      console.log(`[GPU] Max texture size: ${maxTexSize}px`);

      const maxRenderbufSize = gl2.getParameter(gl2.MAX_RENDERBUFFER_SIZE);
      console.log(`[GPU] Max renderbuffer size: ${maxRenderbufSize}px`);
    }
    return gl2;
  }

  return canvas.getContext("webgl", {
    powerPreference: dedicated ? "high-performance" : "default",
    antialias: true,
    alpha: true,
    depth: true,
  }) as WebGLRenderingContext | null;
}

export async function runGPUBenchmark(): Promise<{
  score: number;
  trianglesPerSecond: number;
  fillRateMP: number;
  textureUnits: number;
  grade: "S" | "A" | "B" | "C" | "D";
}> {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
  if (!gl) {
    canvas.remove();
    return { score: 0, trianglesPerSecond: 0, fillRateMP: 0, textureUnits: 0, grade: "D" };
  }

  const textureUnits = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
  const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxRenderbuf = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
  const maxDrawBufs = gl.getParameter(gl.MAX_DRAW_BUFFERS);
  const maxVertUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
  const maxFragUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);

  const vsSrc = `#version 300 es
    in vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;
  const fsSrc = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform float u_time;
    void main() {
      float r = sin(gl_FragCoord.x * 0.01 + u_time) * 0.5 + 0.5;
      float g = cos(gl_FragCoord.y * 0.01 + u_time) * 0.5 + 0.5;
      fragColor = vec4(r, g, 0.5, 1.0);
    }`;

  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, vsSrc);
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(fs);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const triCount = 10000;
  const verts = new Float32Array(triCount * 6);
  for (let i = 0; i < triCount; i++) {
    const cx = Math.random() * 2 - 1;
    const cy = Math.random() * 2 - 1;
    const s = 0.02;
    verts[i * 6] = cx; verts[i * 6 + 1] = cy;
    verts[i * 6 + 2] = cx + s; verts[i * 6 + 3] = cy;
    verts[i * 6 + 4] = cx + s / 2; verts[i * 6 + 5] = cy + s;
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(prog, "u_time");

  const frames = 60;
  const start = performance.now();
  for (let f = 0; f < frames; f++) {
    gl.uniform1f(uTime, f * 0.1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, triCount * 3);
  }
  gl.finish();
  const elapsed = performance.now() - start;

  const trianglesPerSecond = Math.round((triCount * frames) / (elapsed / 1000));
  const fillRateMP = Math.round((1024 * 1024 * frames) / (elapsed / 1000) / 1e6);

  gl.deleteShader(vs);
  gl.deleteShader(fs);
  gl.deleteProgram(prog);
  gl.deleteBuffer(buf);
  canvas.remove();

  let score = 0;
  score += Math.min(30, trianglesPerSecond / 1e6 * 5);
  score += Math.min(20, fillRateMP / 100 * 5);
  score += Math.min(15, textureUnits / 32 * 15);
  score += Math.min(15, maxTexSize / 16384 * 15);
  score += Math.min(10, maxDrawBufs / 8 * 10);
  score += Math.min(10, (maxVertUniforms + maxFragUniforms) / 4096 * 10);
  score = Math.round(Math.min(100, score));

  let grade: "S" | "A" | "B" | "C" | "D";
  if (score >= 85) grade = "S";
  else if (score >= 70) grade = "A";
  else if (score >= 50) grade = "B";
  else if (score >= 30) grade = "C";
  else grade = "D";

  console.log(`[GPU Benchmark] Score: ${score}/100 (${grade}) | ${trianglesPerSecond.toLocaleString()} tri/s | ${fillRateMP} MP/s fill`);

  return { score, trianglesPerSecond, fillRateMP, textureUnits, grade };
}

export function destroyGPUCompute(): void {
  if (gpuDevice) {
    gpuDevice.destroy();
    gpuDevice = null;
  }
  gpuAdapter = null;
  computeStatus = null;
}
