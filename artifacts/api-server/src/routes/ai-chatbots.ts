import { Router, type IRouter, type Request, type Response } from "express";
import { buildOfflineResponse } from "../lib/offline-knowledge-base";
import { openai, aiProvider } from "@workspace/integrations-openai-ai-server";
import { SAI_CONFIDENTIALITY_RULES, SAI_ERROR_BRAND } from "../lib/ai-confidentiality";
import { ULTRA_VALIDATION_RULES } from "../lib/validation-rules";

type AIProvider = "openrouter";

interface PersonalGeminiKeyEntry { id: string; key: string; label: string }

async function tryPersonalKeys(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  _personalGeminiKeys: PersonalGeminiKeyEntry[],
  _personalDeepseekKey?: string,
): Promise<{ text: string | null; failedKeyIds: string[]; provider: string }> {
  const msgs = [{ role: "system", content: systemPrompt }, ...messages];
  const orKey = process.env["AI_INTEGRATIONS_OPENROUTER_API_KEY"];
  // Replit AI Integrations proxy: endpoint is /chat/completions (no /api/v1 prefix)
  const orUrl = `${process.env["AI_INTEGRATIONS_OPENROUTER_BASE_URL"] ?? "https://openrouter.ai"}/chat/completions`;
  if (orKey) {
    try {
      const res = await fetch(orUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${orKey}` },
        body: JSON.stringify({
          model: "gpt-5.3-codex",
          messages: msgs,
          max_tokens: 16384,
          reasoning_effort: "high",  // o-series deep thinking (no temperature)
        }),
        signal: AbortSignal.timeout(90000),  // extended for deep reasoning
      });
      if (res.ok) {
        const data = await res.json() as { choices: { message: { content: string } }[] };
        const text = data.choices?.[0]?.message?.content;
        if (text) return { text, failedKeyIds: [], provider: "gpt-5.3-codex-deep" };
      }
    } catch { /* ignore */ }
  }
  return { text: null, failedKeyIds: [], provider: "" };
}

interface ProviderConfig {
  key: string | undefined;
  url: string;
  model: string;
  maxTokens: number;
  format: "openai" | "anthropic";
}

function getProviderConfigs(): Record<AIProvider, ProviderConfig> {
  return {
    openrouter: {
      key: process.env["AI_INTEGRATIONS_OPENROUTER_API_KEY"]
        ?? process.env["OPENROUTER_API_KEY_"]
        ?? process.env["OPENROUTER_API_KEY"],
      url: `${process.env["AI_INTEGRATIONS_OPENROUTER_BASE_URL"] ?? "https://openrouter.ai"}/chat/completions`,
      model: "anthropic/claude-sonnet-4.6",
      maxTokens: 16000,   // thinking budget (10000) + output tokens (6000)
      format: "openai",
    },
  };
}

async function callExternalAI(
  provider: AIProvider,
  systemPrompt: string,
  messages: { role: string; content: string }[],
): Promise<string | null> {
  const configs = getProviderConfigs();
  const cfg = configs[provider];
  if (!cfg.key) return null;

  try {
    if (cfg.format === "anthropic") {
      const response = await fetch(cfg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: cfg.maxTokens,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) return null;
      const data = await response.json() as { content: { type: string; text: string }[] };
      return data.content?.[0]?.text ?? null;
    }

    const activeModel = cfg.model;
    const isClaude = activeModel.toLowerCase().includes("claude");

    // Claude extended thinking: temperature MUST be 1, add thinking block
    // Codex / other o-series: use reasoning_effort instead of temperature
    const bodyObj: Record<string, unknown> = {
      model: activeModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      max_tokens: cfg.maxTokens,
    };
    if (isClaude) {
      bodyObj.temperature = 1;                                      // required for thinking
      bodyObj.thinking = { type: "enabled", budget_tokens: 10000 }; // deep thinking
    } else {
      bodyObj.temperature = 0.5;
    }

    try {
      const response = await fetch(cfg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.key}`,
        },
        body: JSON.stringify(bodyObj),
        signal: AbortSignal.timeout(90000),  // extended for deep thinking
      });

      if (!response.ok) return null;
      const data = await response.json() as { choices: { message: { content: string } }[] };
      return data.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

const FALLBACK_CHAIN: AIProvider[] = ["openrouter"];

async function callWithFallback(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  preferredProvider?: AIProvider,
): Promise<{ result: string | null; usedProvider: AIProvider | "offline" }> {
  const chain: AIProvider[] = preferredProvider
    ? [preferredProvider, ...FALLBACK_CHAIN.filter(p => p !== preferredProvider)]
    : FALLBACK_CHAIN;

  for (const provider of chain) {
    const result = await callExternalAI(provider, systemPrompt, messages);
    if (result) return { result, usedProvider: provider };
  }
  return { result: null, usedProvider: "offline" };
}

const router: IRouter = Router();

export type ChatbotCategory = "design" | "manufacturing" | "material" | "quality" | "process";

interface ChatbotMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatbotConfig {
  id: ChatbotCategory;
  name: string;
  nameHi: string;
  systemPrompt: string;
  offlineKeywords: string[];
  icon: string;
  color: string;
}

const CHATBOT_CONFIGS: ChatbotConfig[] = [
  {
    id: "design",
    name: "Design Expert",
    nameHi: "डिज़ाइन एक्सपर्ट",
    icon: "✏️",
    color: "#3b82f6",
    systemPrompt: `${ULTRA_VALIDATION_RULES}
You are the Sai Rolotech Smart Engines Design Expert AI — specialized in roll forming profile design, DXF analysis, bend calculations, and power pattern optimization.
Your expertise includes:
- Profile cross-section design and optimization
- DXF file interpretation and geometry analysis
- Bend angle calculation and K-factor optimization
- Power pattern station distribution
- Neutral axis positioning
- Spring-back compensation
- Profile tolerancing and GD&T
Always provide precise engineering values. When discussing bend angles, include spring-back factors. For profile design, always consider material grain direction.
${SAI_CONFIDENTIALITY_RULES}`,
    offlineKeywords: ["profile", "design", "bend", "dxf", "flower", "k-factor", "neutral", "spring", "angle", "geometry", "cross-section", "tolerance"],
  },
  {
    id: "manufacturing",
    name: "Manufacturing Expert",
    nameHi: "मैन्युफैक्चरिंग एक्सपर्ट",
    icon: "⚙️",
    color: "#f59e0b",
    systemPrompt: `${ULTRA_VALIDATION_RULES}
You are the Sai Rolotech Smart Engines Manufacturing Expert AI — specialized in CNC machining, G-code programming, toolpath optimization, and machine operations.
Your expertise includes:
- G-code programming (Fanuc, Delta 2X, Siemens controllers)
- Toolpath strategy and optimization
- CNC turning operations for roll manufacturing
- Feed rate and spindle speed calculations
- Tool life management
- Cycle time optimization
- Machine safety protocols (G28, safe Z heights)
- Post-processor configuration
Always provide specific G-code examples when possible. Include safety warnings for critical operations.
${SAI_CONFIDENTIALITY_RULES}`,
    offlineKeywords: ["gcode", "g-code", "cnc", "toolpath", "feed", "spindle", "turning", "lathe", "machine", "post-processor", "cycle", "program"],
  },
  {
    id: "material",
    name: "Material Expert",
    nameHi: "मटीरियल एक्सपर्ट",
    icon: "🔩",
    color: "#10b981",
    systemPrompt: `${ULTRA_VALIDATION_RULES}
You are the Sai Rolotech Smart Engines Material Expert AI — specialized in steel grades, tooling materials, surface treatments, and material selection for roll forming.
Your expertise includes:
- Steel grades (AISI 304, 316, 1018, D2, M2, H13)
- Material hardness (HRC/HRB) and heat treatment
- Roll material selection (tool steel, carbide, HSS)
- Surface coatings (TiN, TiCN, TiAlN, DLC, chrome plating)
- Material compatibility for forming different profiles
- Wear resistance analysis
- Insert grades (CNMG, VNMG, WNMG — coated vs uncoated)
- Lubricant and coolant selection
Always specify hardness ranges and recommended heat treatment cycles.
${SAI_CONFIDENTIALITY_RULES}`,
    offlineKeywords: ["material", "steel", "hardness", "coating", "insert", "grade", "heat", "treatment", "carbide", "hss", "tool", "wear", "lubricant"],
  },
  {
    id: "quality",
    name: "Quality Inspector",
    nameHi: "क्वालिटी इंस्पेक्टर",
    icon: "🔍",
    color: "#ef4444",
    systemPrompt: `${ULTRA_VALIDATION_RULES}
You are the Sai Rolotech Smart Engines Quality Inspector AI — specialized in defect diagnosis, tolerance verification, and quality assurance for roll formed products.
Your expertise includes:
- Roll forming defects: twist, camber, bow, flare, edge wave, oil canning
- Root cause analysis for each defect type
- Tolerance verification (dimensional, angular, flatness)
- Surface quality assessment
- Measurement techniques and instruments
- SPC (Statistical Process Control) methods
- ISO standards compliance for roll formed products
- First-article inspection procedures
Always provide specific corrective actions with measurable parameters.
${SAI_CONFIDENTIALITY_RULES}`,
    offlineKeywords: ["defect", "quality", "twist", "camber", "bow", "flare", "wave", "tolerance", "inspection", "spc", "iso", "measurement", "surface"],
  },
  {
    id: "process",
    name: "Process Optimizer",
    nameHi: "प्रोसेस ऑप्टिमाइज़र",
    icon: "📊",
    color: "#8b5cf6",
    systemPrompt: `${ULTRA_VALIDATION_RULES}
You are the Sai Rolotech Smart Engines Process Optimizer AI — specialized in production efficiency, line speed optimization, cost reduction, and workflow improvement.
Your expertise includes:
- Roll forming line speed optimization
- Production throughput analysis
- OEE (Overall Equipment Effectiveness) calculation
- Changeover time reduction (SMED methodology)
- Energy consumption optimization
- Cost-per-meter analysis
- Preventive maintenance scheduling
- Production bottleneck identification
- Lean manufacturing principles for roll forming
Always provide quantified improvements with before/after comparisons.
${SAI_CONFIDENTIALITY_RULES}`,
    offlineKeywords: ["speed", "efficiency", "cost", "production", "oee", "changeover", "throughput", "maintenance", "energy", "optimize", "lean", "bottleneck"],
  },
];

function getOfflineExpertResponse(category: ChatbotCategory, message: string): string {
  const config = CHATBOT_CONFIGS.find(c => c.id === category);
  if (!config) return "Expert not found.";

  const lowerMsg = message.toLowerCase();

  const responses: Record<ChatbotCategory, Record<string, string>> = {
    design: {
      // FIX: K-factors updated to DIN 6935 roll forming values (was ANSI press-brake 0.33/0.38)
      profile: "Profile Design Analysis:\n\n1. Cross-section geometry must maintain minimum bend radius = 1.5× material thickness\n2. Maximum recommended bend angle per station: 15° for mild steel, 10° for stainless\n3. K-factor (DIN 6935): mild steel/GI = 0.44, stainless 304 = 0.50, HR = 0.42\n4. Always check neutral axis position: NA = t × K-factor from inside surface\n5. Spring-back compensation: Add 2-4° over-bend for mild steel, 5-8° for stainless",
      bend: "Bend Calculation Guide:\n\n• Bend Allowance (BA) = π/180 × angle × (radius + K × thickness)\n• K-factor values (DIN 6935, roll forming):\n  - GI / CR Mild Steel: 0.44\n  - HR Steel: 0.42\n  - Stainless 304: 0.50\n  - Aluminium: 0.43\n  - HSLA: 0.45\n• Minimum bend radius = 1× thickness (mild steel), 1.5× (stainless)\n• Spring-back factor: 2-3° (mild), 5-8° (stainless), 3-5° (aluminum)",
      flower: "Power Pattern Optimization:\n\n• Station count formula: N = Total bend angle ÷ Max angle per pass\n• Recommended max angle/pass: 12-15° (mild steel), 8-10° (stainless)\n• Distribution: Progressive — lighter bending in early stations, heavier in middle\n• Calibration passes: Last 2-3 stations for final shape accuracy\n• Always verify strip width remains constant through all stations",
      default: "Design Expert — Offline Mode\n\nI can help with: profile design, bend calculations, power patterns, DXF analysis, K-factor optimization, and spring-back compensation.\n\nPlease ask a specific question about your roll forming design.",
    },
    manufacturing: {
      gcode: "G-Code Programming Guide:\n\n• Program structure: Header → Tool call → Cutting → Retract → End\n• Delta 2X specifics: Use M4 (reverse spindle), G92 S500 (max RPM)\n• Safe Z height: Z50. for Delta 2X, Z100. for standard Fanuc\n• Feed rate: 0.15-0.25 mm/rev for roughing, 0.08-0.12 for finishing\n• Always include G28 safety retract at tool changes",
      feed: "Speed & Feed Calculations:\n\n• Cutting speed (Vc) = π × D × N ÷ 1000 (m/min)\n• Feed rate: Roughing 0.2-0.3 mm/rev, Finishing 0.08-0.15 mm/rev\n• Depth of cut: Roughing 1.5-3.0 mm, Finishing 0.2-0.5 mm\n• For D2 tool steel (HRC 58-62): Vc = 80-120 m/min with coated carbide\n• For mild steel rolls: Vc = 150-200 m/min",
      toolpath: "Toolpath Strategy for Roll Turning:\n\n• OP10: Face both ends, establish datum\n• OP20: Rough turn OD with 1.5mm DOC, leave 0.3mm finish stock\n• OP30: Semi-finish contour, 0.5mm DOC\n• OP40: Finish profile to final dimension\n• OP50: Groove/undercut operations\n• Always use constant surface speed (CSS) mode — G96",
      default: "Manufacturing Expert — Offline Mode\n\nI can help with: G-code programming, toolpath optimization, CNC operations, feed/speed calculations, and machine setup.\n\nPlease ask about your specific manufacturing challenge.",
    },
    material: {
      steel: "Steel Grade Selection:\n\n• Roll material: D2 (HRC 58-62) for high-volume production\n• Shaft material: 4140 (HRC 28-32) for standard applications\n• Spacer rings: 1018 mild steel, stress-relieved\n• For stainless forming: Use chrome-plated D2 rolls\n• For aluminum forming: Use hardened H13 or polished D2",
      coating: "Surface Coating Guide:\n\n• TiN (Gold): General purpose, HV 2300, temp 600°C\n• TiCN (Grey-violet): Better wear, HV 3000, temp 400°C\n• TiAlN (Black-violet): High temp, HV 3300, temp 900°C\n• DLC (Black): Low friction, HV 3500, for non-ferrous metals\n• Chrome plating: 50-75 µm for corrosion resistance on forming rolls",
      insert: "Cutting Insert Selection:\n\n• CNMG 120404-MF: Finishing, 0.4mm nose radius\n• CNMG 120408-MR: Medium roughing, 0.8mm nose radius\n• VNMG 160404: V-groove and contour finishing\n• Grade IC8250: For hardened steel (HRC 45-65)\n• Grade IC6015: General purpose steel turning",
      default: "Material Expert — Offline Mode\n\nI can help with: steel grade selection, tooling materials, surface coatings, insert recommendations, and heat treatment advice.\n\nPlease ask about your material requirements.",
    },
    quality: {
      defect: "Common Roll Forming Defects & Solutions:\n\n1. TWIST: Caused by unequal strip elongation → Equalize material flow, check station alignment\n2. CAMBER: Material curves sideways → Adjust roll gap symmetry, check coil set\n3. BOW: Lengthwise curvature → Adjust vertical roll positions, check strip tension\n4. FLARE: Edges spring open → Add over-bend, increase calibration station pressure\n5. EDGE WAVE: Wavy edges → Reduce edge stretching, add side rolls\n6. OIL CANNING: Surface waviness → Increase forming stations, reduce bend angle/pass",
      tolerance: "Tolerance Standards:\n\n• Dimensional: ±0.1mm for standard profiles, ±0.05mm for precision\n• Angular: ±0.5° standard, ±0.25° precision\n• Straightness: 1mm per meter length\n• Flatness: 0.5mm per 300mm width\n• Surface roughness: Ra 0.8-1.6 µm for formed surfaces\n• Measurement: Use CMM, optical comparator, or go/no-go gauges",
      inspection: "First Article Inspection Checklist:\n\n1. ☐ Cross-section dimensions (all critical)\n2. ☐ Bend angles (protractor/CMM)\n3. ☐ Material thickness at bend zones\n4. ☐ Surface finish quality\n5. ☐ Straightness over 1m length\n6. ☐ Hole positions (if punched)\n7. ☐ Cut length accuracy\n8. ☐ Edge condition (burr-free)\n9. ☐ Material certificate verification\n10. ☐ Documentation complete",
      default: "Quality Inspector — Offline Mode\n\nI can help with: defect diagnosis, tolerance verification, inspection procedures, SPC analysis, and corrective actions.\n\nDescribe your quality issue for detailed analysis.",
    },
    process: {
      speed: "Line Speed Optimization:\n\n• Mild steel profiles: 15-30 m/min typical\n• Stainless steel: 10-20 m/min\n• Aluminum: 25-40 m/min\n• Factors: Profile complexity, material thickness, number of stations\n• Optimization: Start at 70% of max speed, increase 5% increments\n• Monitor: Edge quality, dimensional accuracy, tooling temperature",
      efficiency: "OEE Calculation:\n\n• OEE = Availability × Performance × Quality\n• Target: ≥ 85% (World Class)\n• Availability = Run time ÷ Planned production time\n• Performance = (Ideal cycle time × Total count) ÷ Run time\n• Quality = Good count ÷ Total count\n• Typical roll forming OEE: 65-75%\n• Quick wins: Reduce changeover (SMED), preventive maintenance, operator training",
      cost: "Cost-Per-Meter Analysis:\n\n• Material cost: Weight/m × ₹/kg\n• Energy cost: kW consumption × hours × ₹/kWh ÷ meters produced\n• Labor cost: Operator rate ÷ meters/hour\n• Tooling cost: Tool price ÷ expected tool life (meters)\n• Overhead: 15-25% of direct costs\n• Scrap factor: Add 2-5% for startup waste\n• Target: Reduce total cost by 10-15% through speed optimization",
      default: "Process Optimizer — Offline Mode\n\nI can help with: line speed optimization, OEE improvement, cost analysis, changeover reduction, and production planning.\n\nDescribe your production setup for optimization recommendations.",
    },
  };

  const categoryResponses = responses[category];
  for (const [key, value] of Object.entries(categoryResponses)) {
    if (key !== "default" && lowerMsg.includes(key)) {
      return value;
    }
  }

  for (const keyword of config.offlineKeywords) {
    if (lowerMsg.includes(keyword)) {
      return buildOfflineResponse(message, "detailed", "english");
    }
  }

  return categoryResponses["default"] || "Please ask a question related to this category.";
}

async function getOnlineExpertResponse(
  category: ChatbotCategory,
  message: string,
  history: ChatbotMessage[],
  personalGeminiKeys: PersonalGeminiKeyEntry[] = [],
  personalDeepseekKey?: string,
): Promise<{ text: string; mode: "online" | "offline"; provider?: string; failedKeyIds?: string[] }> {
  const config = CHATBOT_CONFIGS.find(c => c.id === category);
  if (!config) return { text: "Expert not found.", mode: "offline" };

  const chatMessages = history.slice(-8).map(e => ({ role: e.role, content: e.content }));
  chatMessages.push({ role: "user", content: message });

  if (personalGeminiKeys.length > 0 || personalDeepseekKey) {
    const personal = await tryPersonalKeys(config.systemPrompt, chatMessages, personalGeminiKeys, personalDeepseekKey);
    if (personal.text) {
      return { text: personal.text, mode: "online", provider: personal.provider, failedKeyIds: personal.failedKeyIds };
    }
    if (personal.failedKeyIds.length > 0) {
      return await getOnlineExpertResponse(category, message, history, [], undefined).then(r => ({
        ...r, failedKeyIds: personal.failedKeyIds,
      }));
    }
  }

  const providerChain: { provider: AIProvider; label: string }[] = [
    { provider: "openrouter", label: "claude-sonnet-4.6" },
  ];

  for (const { provider, label } of providerChain) {
    const result = await callExternalAI(provider, config.systemPrompt, chatMessages);
    if (result) {
      return { text: result, mode: "online", provider: label };
    }
  }

  try {
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: config.systemPrompt },
      ...history.slice(-8).map(e => ({ role: e.role as "user" | "assistant", content: e.content })),
      { role: "user", content: message },
    ];

    const model = aiProvider === "gemini" ? "gemini-2.5-pro" : "gpt-5-mini";
    const response = await openai.chat.completions.create({
      model,
      messages,
      max_completion_tokens: 8192,
    });

    const text = response.choices?.[0]?.message?.content;
    return { text: text || getOfflineExpertResponse(category, message), mode: text ? "online" : "offline", provider: model };
  } catch {
    return { text: getOfflineExpertResponse(category, message), mode: "offline", provider: "offline-engine" };
  }
}

router.get("/ai/chatbots", (_req: Request, res: Response) => {
  res.json({
    chatbots: CHATBOT_CONFIGS.map(c => ({
      id: c.id,
      name: c.name,
      nameHi: c.nameHi,
      icon: c.icon,
      color: c.color,
    })),
  });
});

router.post("/ai/chatbot/:category", async (req: Request, res: Response) => {
  try {
    const category = req.params["category"] as ChatbotCategory;
    const config = CHATBOT_CONFIGS.find(c => c.id === category);
    if (!config) {
      res.status(400).json({ error: `Invalid chatbot category: ${category}` });
      return;
    }

    const { message, history, forceOffline, personalGeminiKeys, personalDeepseekKey } = req.body as {
      message: string;
      history?: ChatbotMessage[];
      forceOffline?: boolean;
      personalGeminiKeys?: PersonalGeminiKeyEntry[];
      personalDeepseekKey?: string;
    };

    if (!message?.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    let responseText: string;
    let mode: "online" | "offline";
    let provider = "offline-engine";
    let failedKeyIds: string[] | undefined;

    if (forceOffline) {
      responseText = getOfflineExpertResponse(category, message);
      mode = "offline";
    } else {
      const result = await getOnlineExpertResponse(
        category, message, history ?? [],
        personalGeminiKeys ?? [], personalDeepseekKey,
      );
      responseText = result.text;
      mode = result.mode;
      provider = result.provider ?? "unknown";
      failedKeyIds = result.failedKeyIds;
    }

    res.json({
      response: responseText,
      mode,
      provider,
      failedKeyIds,
      chatbot: { id: config.id, name: config.name, icon: config.icon },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Chatbot failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/ai/quality-check", async (req: Request, res: Response) => {
  try {
    const {
      materialType, thickness, numStations, totalBends,
      bendAngles, rollDiameter, lineSpeed, profileComplexity,
    } = req.body as {
      materialType: string;
      thickness: number;
      numStations: number;
      totalBends: number;
      bendAngles?: number[];
      rollDiameter?: number;
      lineSpeed?: number;
      profileComplexity?: string;
    };

    if (!materialType || !thickness || !numStations) {
      res.status(400).json({ error: "materialType, thickness, and numStations are required" });
      return;
    }

    const checks: {
      category: ChatbotCategory;
      name: string;
      icon: string;
      score: number;
      status: "pass" | "fail" | "warning";
      findings: string[];
      recommendations: string[];
    }[] = [];

    const maxAngle = bendAngles ? Math.max(...bendAngles) : totalBends / Math.max(numStations, 1);
    const avgAngle = bendAngles ? bendAngles.reduce((a, b) => a + b, 0) / bendAngles.length : totalBends / Math.max(numStations, 1);

    // 1. Design Check
    {
      const findings: string[] = [];
      const recommendations: string[] = [];
      let score = 100;

      if (maxAngle > 15) {
        score -= 20;
        findings.push(`Maximum bend angle ${maxAngle.toFixed(1)}° exceeds 15° per station limit`);
        recommendations.push("Reduce maximum bend angle per station to ≤ 15° by adding more stations");
      }
      if (numStations < Math.ceil(totalBends / 12)) {
        score -= 15;
        findings.push(`${numStations} stations may be insufficient for ${totalBends}° total bend`);
        recommendations.push(`Increase stations to at least ${Math.ceil(totalBends / 12)}`);
      }
      if (thickness < 0.3) {
        score -= 10;
        findings.push(`Thickness ${thickness}mm is very thin — high risk of wrinkling`);
        recommendations.push("Use support rolls and reduce line speed for thin materials");
      }
      if (score >= 80) findings.push("Profile geometry within safe design parameters");

      checks.push({
        category: "design",
        name: "Design Expert",
        icon: "✏️",
        score: Math.max(0, score),
        status: score >= 70 ? (score >= 85 ? "pass" : "warning") : "fail",
        findings: findings.length > 0 ? findings : ["Design parameters within acceptable range"],
        recommendations,
      });
    }

    // 2. Manufacturing Check
    {
      const findings: string[] = [];
      const recommendations: string[] = [];
      let score = 100;

      if (rollDiameter && rollDiameter < 80) {
        score -= 15;
        findings.push(`Roll diameter ${rollDiameter}mm is below minimum 80mm recommendation`);
        recommendations.push("Increase roll diameter for better forming quality and tool life");
      }
      if (lineSpeed && lineSpeed > 30 && materialType.toLowerCase().includes("stainless")) {
        score -= 20;
        findings.push(`Line speed ${lineSpeed} m/min too high for stainless steel`);
        recommendations.push("Reduce line speed to 10-20 m/min for stainless steel");
      }
      if (numStations > 20) {
        score -= 5;
        findings.push(`${numStations} stations — check alignment and lubrication requirements`);
        recommendations.push("Implement station-by-station alignment verification");
      }
      if (score >= 80) findings.push("Manufacturing parameters are within operational limits");

      checks.push({
        category: "manufacturing",
        name: "Manufacturing Expert",
        icon: "⚙️",
        score: Math.max(0, score),
        status: score >= 70 ? (score >= 85 ? "pass" : "warning") : "fail",
        findings: findings.length > 0 ? findings : ["Manufacturing setup is appropriate"],
        recommendations,
      });
    }

    // 3. Material Check
    {
      const findings: string[] = [];
      const recommendations: string[] = [];
      let score = 100;
      const mat = materialType.toLowerCase();

      if (mat.includes("stainless") && thickness > 3) {
        score -= 15;
        findings.push(`Stainless steel at ${thickness}mm requires high forming force`);
        recommendations.push("Use D2 hardened rolls (HRC 58-62) with TiAlN coating");
      }
      if (mat.includes("aluminum") && avgAngle > 12) {
        score -= 10;
        findings.push("Aluminum prone to galling at high bend angles");
        recommendations.push("Apply DLC coating on rolls and use appropriate lubricant");
      }
      if (!mat.includes("mild") && !mat.includes("stainless") && !mat.includes("aluminum") && !mat.includes("galv")) {
        score -= 5;
        findings.push(`Material "${materialType}" — verify forming characteristics and tool compatibility`);
        recommendations.push("Conduct trial forming run with sample material");
      }
      if (score >= 80) findings.push("Material selection is compatible with design parameters");

      checks.push({
        category: "material",
        name: "Material Expert",
        icon: "🔩",
        score: Math.max(0, score),
        status: score >= 70 ? (score >= 85 ? "pass" : "warning") : "fail",
        findings: findings.length > 0 ? findings : ["Material is suitable for this application"],
        recommendations,
      });
    }

    // 4. Quality Check
    {
      const findings: string[] = [];
      const recommendations: string[] = [];
      let score = 100;

      if (maxAngle > 12 && numStations < 10) {
        score -= 15;
        findings.push("High bend angle with few stations increases twist/camber risk");
        recommendations.push("Add intermediate calibration stations to control twist");
      }
      if (thickness > 2 && avgAngle > 10) {
        score -= 10;
        findings.push("Thick material with sharp bends — potential for spring-back issues");
        recommendations.push(`Add ${Math.ceil(avgAngle * 0.15)}° spring-back compensation per bend`);
      }
      const complexity = profileComplexity?.toLowerCase() || "medium";
      if (complexity === "high" || complexity === "complex") {
        score -= 10;
        findings.push("Complex profile — higher risk of dimensional variation");
        recommendations.push("Implement SPC monitoring on critical dimensions");
      }
      if (score >= 80) findings.push("Quality risk assessment within acceptable limits");

      checks.push({
        category: "quality",
        name: "Quality Inspector",
        icon: "🔍",
        score: Math.max(0, score),
        status: score >= 70 ? (score >= 85 ? "pass" : "warning") : "fail",
        findings: findings.length > 0 ? findings : ["Quality parameters are satisfactory"],
        recommendations,
      });
    }

    // 5. Process Check
    {
      const findings: string[] = [];
      const recommendations: string[] = [];
      let score = 100;

      if (lineSpeed && lineSpeed < 5) {
        score -= 10;
        findings.push(`Line speed ${lineSpeed} m/min is very slow — low throughput`);
        recommendations.push("Optimize forming sequence to allow higher line speed");
      }
      if (numStations > 15 && (!lineSpeed || lineSpeed > 20)) {
        score -= 5;
        findings.push("Many stations with high speed — monitor energy consumption");
        recommendations.push("Calculate OEE and energy cost per meter for optimization");
      }
      const estimatedChangeover = numStations * 8;
      if (estimatedChangeover > 120) {
        score -= 10;
        findings.push(`Estimated changeover time: ${estimatedChangeover} min (${numStations} stations × 8 min)`);
        recommendations.push("Implement SMED methodology to reduce changeover below 60 min");
      }
      if (score >= 80) findings.push("Process parameters are optimized for production efficiency");

      checks.push({
        category: "process",
        name: "Process Optimizer",
        icon: "📊",
        score: Math.max(0, score),
        status: score >= 70 ? (score >= 85 ? "pass" : "warning") : "fail",
        findings: findings.length > 0 ? findings : ["Process is well-optimized"],
        recommendations,
      });
    }

    const overallScore = Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length);
    const passCount = checks.filter(c => c.status === "pass").length;
    const failCount = checks.filter(c => c.status === "fail").length;
    const warningCount = checks.filter(c => c.status === "warning").length;

    const overallStatus = failCount > 0 ? "fail" : warningCount > 1 ? "warning" : "pass";

    const reportSummary = `Quality Check Report — ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall Score: ${overallScore}% | Status: ${overallStatus.toUpperCase()}
Passed: ${passCount}/5 | Warnings: ${warningCount}/5 | Failed: ${failCount}/5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Material: ${materialType} | Thickness: ${thickness}mm
Stations: ${numStations} | Total Bend: ${totalBends}°
${lineSpeed ? `Line Speed: ${lineSpeed} m/min` : ""}
${rollDiameter ? `Roll Diameter: ${rollDiameter}mm` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${checks.map(c => `${c.icon} ${c.name}: ${c.score}% [${c.status.toUpperCase()}]
  Findings: ${c.findings.join("; ")}
  ${c.recommendations.length > 0 ? `Actions: ${c.recommendations.join("; ")}` : ""}`).join("\n\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by Sai Rolotech Smart Engines Quality System (Offline Engine)`;

    res.json({
      success: true,
      overallScore,
      overallStatus,
      passCount,
      failCount,
      warningCount,
      checks,
      reportSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Quality check failed";
    res.status(500).json({ error: msg });
  }
});

// ─── Master Designer AI Route ─────────────────────────────────────────────────

router.post("/chatbot/master-designer", async (req: Request, res: Response) => {
  try {
    const { message, history, projectContext, personalGeminiKeys, personalDeepseekKey } = req.body as {
      message: string;
      history: { role: string; content: string }[];
      projectContext?: string;
      personalGeminiKeys?: PersonalGeminiKeyEntry[];
      personalDeepseekKey?: string;
    };

    if (!message?.trim()) {
      res.status(400).json({ error: "message required" });
      return;
    }

    const systemPrompt = `${ULTRA_VALIDATION_RULES}
You are the Master Designer — a roll forming expert with 50 years of deep hands-on industry experience. You have worked in roll forming plants across Asia, Europe and North America, designing thousands of profiles including C/U/Z channels, purlins, railings, gutters, automotive profiles, tubes and complex closed sections.

Your personality:
- Direct, confident and precise — you say "use 15° per pass for this material" not "you might want to consider..."
- You draw from real plant experience: you remember the machine that cracked a shaft in 1989 because of an undersized keyway, and you've seen every springback problem imaginable
- You speak plainly but with deep technical authority
- When you see a problem you name it clearly and give a specific fix

Your expertise covers:
- Flower pattern design (number of stations, angle increments, progressive bending strategy)
- Roll tooling (material selection, groove geometry, shaft design, wear prevention)
- Machine parameters (line speed, roll gap, motor sizing, drive ratios)
- Defect diagnosis (camber, bow, twist, springback, edge wave, cracking)
- Material behavior (GI, PPGL, PPGI, stainless, aluminum, high-strength steel)
- Springback compensation, K-factor, bend allowance
- G-code review and CNC roll turning practice
- Machine BOM and line setup

Current project context:
${projectContext || "No project loaded"}

When answering:
1. Be specific with numbers when you can (degrees, mm, N/mm², RPM, etc.)
2. Reference the user's actual project data from the context above
3. Give practical plant-floor advice, not just textbook answers
4. If something in their project looks risky, say so directly
5. Keep responses focused and actionable — no fluff`;

    const msgs = (history || []).slice(-8).map(m => ({ role: m.role, content: m.content }));
    msgs.push({ role: "user", content: message });

    let response: string | null = null;
    let usedProvider = "offline-engine";
    let failedKeyIds: string[] | undefined;

    if ((personalGeminiKeys?.length ?? 0) > 0 || personalDeepseekKey) {
      const personal = await tryPersonalKeys(systemPrompt, msgs, personalGeminiKeys ?? [], personalDeepseekKey);
      if (personal.text) { response = personal.text; usedProvider = personal.provider; }
      if (personal.failedKeyIds.length > 0) failedKeyIds = personal.failedKeyIds;
    }

    if (!response) {
      const providers: AIProvider[] = ["openrouter"];
      for (const provider of providers) {
        response = await callExternalAI(provider, systemPrompt, msgs);
        if (response) { usedProvider = provider; break; }
      }
    }

    if (!response) {
      const kb = buildOfflineResponse(message, "detailed", "en");
      response = `[Master Designer — Offline Knowledge Base]\n\n${kb}\n\n(Offline mode: AI networks unavailable. Drawing from 50 years of embedded knowledge.)`;
      usedProvider = "offline-engine";
    }

    res.json({
      response,
      mode: usedProvider === "offline-engine" ? "offline" : "online",
      provider: usedProvider,
      failedKeyIds,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Master Designer error";
    res.status(500).json({ error: msg });
  }
});

export default router;
