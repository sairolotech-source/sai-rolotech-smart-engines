export interface LaptopHardwareInfo {
  browser: {
    name: string;
    version: string;
    engine: string;
    webSerialSupported: boolean;
    webUSBSupported: boolean;
    webBluetoothSupported: boolean;
    webGLSupported: boolean;
    webGL2Supported: boolean;
  };
  screen: {
    width: number;
    height: number;
    pixelRatio: number;
    colorDepth: number;
    refreshRate?: number;
  };
  cpu: {
    logicalCores: number;
    estimatedPerformance: "low" | "medium" | "high" | "ultra";
  };
  memory: {
    estimatedGB: number | null;
  };
  gpu: {
    vendor: string;
    renderer: string;
    tier: "integrated" | "dedicated" | "unknown";
    maxTextureSize: number;
    extensions: number;
    unmaskedVendor: string;
    unmaskedRenderer: string;
  };
  platform: {
    os: string;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    language: string;
    onLine: boolean;
    connectionType: string;
  };
  battery?: {
    charging: boolean;
    level: number;
    chargingTime: number;
    dischargingTime: number;
  } | null;
}

export async function detectLaptopHardware(): Promise<LaptopHardwareInfo> {
  const ua = navigator.userAgent;

  const getBrowserName = () => {
    if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
    if (ua.includes("Edg")) return "Edge";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    return "Unknown";
  };

  const getBrowserVersion = () => {
    const m = ua.match(/(Chrome|Firefox|Safari|Edg(?:e)?)\/([0-9.]+)/);
    return m ? m[2] : "Unknown";
  };

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl") as WebGLRenderingContext | null;
  const gl2 = canvas.getContext("webgl2") as WebGL2RenderingContext | null;

  let gpuVendor = "Unknown";
  let gpuRenderer = "Unknown";
  let gpuUnmaskedVendor = "Unknown";
  let gpuUnmaskedRenderer = "Unknown";
  let maxTextureSize = 0;
  let extensionCount = 0;

  if (gl) {
    gpuVendor = gl.getParameter(gl.VENDOR) || "Unknown";
    gpuRenderer = gl.getParameter(gl.RENDERER) || "Unknown";
    maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
    extensionCount = (gl.getSupportedExtensions() || []).length;

    const dbgInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbgInfo) {
      gpuUnmaskedVendor = gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL) || gpuVendor;
      gpuUnmaskedRenderer = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) || gpuRenderer;
    }
  }

  const detectGpuTier = (): "integrated" | "dedicated" | "unknown" => {
    const r = gpuUnmaskedRenderer.toLowerCase();
    if (r.includes("nvidia") || r.includes("radeon") || r.includes("amd") || r.includes("geforce")) return "dedicated";
    if (r.includes("intel") || r.includes("uhd") || r.includes("iris") || r.includes("hd graphics")) return "integrated";
    return "unknown";
  };

  const estimateCpuPerf = (cores: number): "low" | "medium" | "high" | "ultra" => {
    if (cores >= 16) return "ultra";
    if (cores >= 8) return "high";
    if (cores >= 4) return "medium";
    return "low";
  };

  let battery = null;
  try {
    if ("getBattery" in navigator) {
      const bat = await (navigator as any).getBattery();
      battery = {
        charging: bat.charging,
        level: Math.round(bat.level * 100),
        chargingTime: bat.chargingTime,
        dischargingTime: bat.dischargingTime,
      };
    }
  } catch {}

  const connection = (navigator as any).connection || (navigator as any).mozConnection || null;
  const connectionType = connection ? (connection.effectiveType || connection.type || "unknown") : "unknown";

  const memGB = (navigator as any).deviceMemory ?? null;
  const cores = navigator.hardwareConcurrency || 1;

  const platform = navigator.platform.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua);
  const isTablet = /ipad|tablet/i.test(ua);

  let refreshRate: number | undefined;
  try {
    await new Promise<void>(resolve => {
      let frames = 0;
      const start = performance.now();
      const count = () => {
        frames++;
        if (performance.now() - start < 1000) requestAnimationFrame(count);
        else {
          refreshRate = Math.round(frames);
          resolve();
        }
      };
      requestAnimationFrame(count);
    });
  } catch {}

  return {
    browser: {
      name: getBrowserName(),
      version: getBrowserVersion(),
      engine: (window as any).chrome ? "Blink" : ua.includes("Gecko") ? "Gecko" : "Unknown",
      webSerialSupported: "serial" in navigator,
      webUSBSupported: "usb" in navigator,
      webBluetoothSupported: "bluetooth" in navigator,
      webGLSupported: !!gl,
      webGL2Supported: !!gl2,
    },
    screen: {
      width: screen.width,
      height: screen.height,
      pixelRatio: window.devicePixelRatio,
      colorDepth: screen.colorDepth,
      refreshRate,
    },
    cpu: {
      logicalCores: cores,
      estimatedPerformance: estimateCpuPerf(cores),
    },
    memory: {
      estimatedGB: memGB,
    },
    gpu: {
      vendor: gpuVendor,
      renderer: gpuRenderer,
      tier: detectGpuTier(),
      maxTextureSize,
      extensions: extensionCount,
      unmaskedVendor: gpuUnmaskedVendor,
      unmaskedRenderer: gpuUnmaskedRenderer,
    },
    platform: {
      os: platform.includes("win") ? "Windows" : platform.includes("mac") ? "macOS" : platform.includes("linux") ? "Linux" : "Unknown",
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet,
      language: navigator.language,
      onLine: navigator.onLine,
      connectionType,
    },
    battery,
  };
}

export async function listSerialPorts(): Promise<SerialPort[]> {
  if (!("serial" in navigator)) throw new Error("WebSerial API not supported. Use Chrome or Edge browser.");
  return await (navigator as any).serial.getPorts();
}

export async function connectToSerialPort(baudRate = 115200): Promise<SerialPort> {
  if (!("serial" in navigator)) throw new Error("WebSerial API not supported. Use Chrome or Edge browser.");
  const port = await (navigator as any).serial.requestPort();
  await port.open({ baudRate });
  return port;
}

export async function sendGCodeToSerial(port: SerialPort, gcode: string): Promise<void> {
  if (!port.writable) throw new Error("Serial port not writable");
  const writer = port.writable.getWriter();
  const encoder = new TextEncoder();
  const lines = gcode.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith(";"));
  for (const line of lines) {
    await writer.write(encoder.encode(line + "\n"));
    await new Promise(r => setTimeout(r, 50));
  }
  writer.releaseLock();
}
