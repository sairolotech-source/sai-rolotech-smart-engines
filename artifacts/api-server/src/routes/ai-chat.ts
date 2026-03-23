import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { setBackupInterval, createBackup } from "./backup";
import { buildOfflineResponse } from "../lib/offline-knowledge-base";
import { openai, aiProvider } from "@workspace/integrations-openai-ai-server";
import { SAI_CONFIDENTIALITY_RULES, SAI_ERROR_BRAND } from "../lib/ai-confidentiality";

const DATA_DIR = path.resolve(process.cwd(), "data");
const MEMORY_FILE = path.join(DATA_DIR, "ai-memory.json");
const SETTINGS_FILE = path.join(DATA_DIR, "user-settings.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadMemory(): ConversationEntry[] {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
    return JSON.parse(raw) as ConversationEntry[];
  } catch {
    return [];
  }
}

function saveMemory(entries: ConversationEntry[]) {
  ensureDataDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

function loadSettings(): UserSettings {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return { ...defaultSettings(), ...JSON.parse(raw) as UserSettings };
  } catch {
    return defaultSettings();
  }
}

function defaultSettings(): UserSettings {
  return {
    language: "english",
    responseStyle: "detailed",
    accuracyMode: "high",
    memoryEnabled: true,
    forceOffline: false,
    backupIntervalSeconds: 60,
  };
}

interface ConversationEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  mode: "online" | "offline";
}

interface UserSettings {
  language: string;
  responseStyle: string;
  accuracyMode: string;
  memoryEnabled: boolean;
  forceOffline: boolean;
  backupIntervalSeconds: number;
}

function offlineResponse(message: string, style: string, language: string): string {
  return buildOfflineResponse(message, style, language);
}

async function onlineResponse(
  message: string,
  history: ConversationEntry[],
  style: string,
  language: string
): Promise<string> {
  const systemPrompt = `You are the Sai Rolotech Smart Engines AI Assistant — an expert for roll forming, CNC machining, and industrial manufacturing. 
Response style: ${style}. Language: ${language}.
Be accurate, concise when asked to be concise, detailed when asked for detail.
Always be helpful and professional.
${SAI_CONFIDENTIALITY_RULES}`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10).map((e) => ({ role: e.role as "user" | "assistant", content: e.content })),
    { role: "user", content: message },
  ];

  if (aiProvider === "gemini") {
    for (const model of ["gemini-3.1-pro-preview", "gemini-3-pro-preview"]) {
      try {
        const response = await openai.chat.completions.create({
          model,
          messages,
          max_completion_tokens: 8192,
        });
        const text = response.choices?.[0]?.message?.content;
        if (text) return text;
        if (model === "gemini-3.1-pro-preview") continue;
      } catch {
        if (model === "gemini-3.1-pro-preview") {
          console.log("[AI] gemini-3.1-pro-preview unavailable — falling back to gemini-3-pro-preview");
          continue;
        }
      }
    }
    return offlineResponse(message, style, language);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages,
      max_completion_tokens: 8192,
    });
    return response.choices?.[0]?.message?.content ?? offlineResponse(message, style, language);
  } catch {
    return offlineResponse(message, style, language);
  }
}

async function callInternetFallback(
  message: string,
  history: ConversationEntry[],
  style: string,
  language: string,
  personalGeminiKey?: string,
): Promise<string | null> {
  const systemPrompt = `You are the Sai Rolotech Smart Engines AI Assistant — an expert for roll forming, CNC machining, and industrial manufacturing.
Response style: ${style}. Language: ${language}.
Be accurate, concise when asked to be concise, detailed when asked for detail.
${SAI_CONFIDENTIALITY_RULES}`;

  const msgs = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10).map(e => ({ role: e.role, content: e.content })),
    { role: "user", content: message },
  ];

  const providers: { key: string | undefined; url: string; model: string; label: string }[] = [];

  if (personalGeminiKey) {
    providers.push({
      key: personalGeminiKey,
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: "gemini-3-pro-preview",
      label: "Personal Gemini 3.0",
    });
  }

  providers.push(
    {
      key: process.env["AI_INTEGRATIONS_OPENROUTER_API_KEY"],
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "deepseek/deepseek-r1:free",
      label: "OpenRouter DeepSeek R1",
    },
    {
      key: process.env["SAMBANOVA_API_KEY"],
      url: "https://api.sambanova.ai/v1/chat/completions",
      model: "Meta-Llama-3.3-70B-Instruct",
      label: "SambaNova Llama 70B",
    },
  );

  for (const p of providers) {
    if (!p.key) continue;
    try {
      const res = await fetch(p.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, messages: msgs, max_tokens: 4096, temperature: 0.5 }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) { console.log(`[AI Fallback] ${p.label} failed (${res.status})`); continue; }
      const data = await res.json() as { choices: { message: { content: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (text) { console.log(`[AI Fallback] Responded via ${p.label}`); return text; }
    } catch (e) { console.log(`[AI Fallback] ${p.label} error:`, e); continue; }
  }
  return null;
}

const router: IRouter = Router();

router.post("/ai/chat", async (req: Request, res: Response) => {
  try {
    const { message, forceOffline, history, personalGeminiKey } = req.body as {
      message: string;
      forceOffline?: boolean;
      history?: ConversationEntry[];
      personalGeminiKey?: string;
    };
    if (!message?.trim()) {
      res.status(400).json({ error: "message required" });
      return;
    }

    const settings = loadSettings();
    const storedMemory = loadMemory();
    const contextHistory: ConversationEntry[] = history ?? storedMemory;

    const isOffline = forceOffline ?? settings.forceOffline ?? false;
    let responseText: string;
    let mode: "online" | "offline";

    if (isOffline) {
      const fallback = await callInternetFallback(message, contextHistory, settings.responseStyle, settings.language, personalGeminiKey);
      if (fallback) {
        responseText = fallback;
        mode = "online";
      } else {
        responseText = offlineResponse(message, settings.responseStyle, settings.language);
        mode = "offline";
      }
    } else {
      try {
        responseText = await onlineResponse(message, contextHistory, settings.responseStyle, settings.language);
        mode = "online";
      } catch {
        const fallback = await callInternetFallback(message, contextHistory, settings.responseStyle, settings.language, personalGeminiKey);
        if (fallback) {
          responseText = fallback;
          mode = "online";
        } else {
          responseText = offlineResponse(message, settings.responseStyle, settings.language);
          mode = "offline";
        }
      }
    }

    const now = new Date().toISOString();
    const userEntry: ConversationEntry = {
      id: `${Date.now()}-u`,
      role: "user",
      content: message,
      timestamp: now,
      mode,
    };
    const assistantEntry: ConversationEntry = {
      id: `${Date.now()}-a`,
      role: "assistant",
      content: responseText,
      timestamp: now,
      mode,
    };

    if (settings.memoryEnabled) {
      storedMemory.push(userEntry, assistantEntry);
      saveMemory(storedMemory);
    }

    res.json({
      response: responseText,
      mode,
      userEntry,
      assistantEntry,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Chat failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/ai/memory", (_req: Request, res: Response) => {
  const memory = loadMemory();
  res.json({ memory, count: memory.length });
});

router.delete("/ai/memory", (_req: Request, res: Response) => {
  ensureDataDir();
  saveMemory([]);
  res.json({ success: true, message: "Memory cleared" });
});

router.get("/ai/history", (_req: Request, res: Response) => {
  const memory = loadMemory();
  res.json({ history: memory, count: memory.length });
});

router.delete("/ai/clear-history", (_req: Request, res: Response) => {
  ensureDataDir();
  saveMemory([]);
  res.json({ success: true });
});

router.post("/ai/backup", (_req: Request, res: Response) => {
  const dest = createBackup();
  res.json({ success: !!dest, path: dest });
});

router.get("/ai/backup-status", (_req: Request, res: Response) => {
  const BACKUPS_DIR = path.join(DATA_DIR, "backups");
  ensureDataDir();
  try {
    let backupCount = 0;
    let lastBackup: string | null = null;
    if (fs.existsSync(BACKUPS_DIR)) {
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith(".json"));
      backupCount = files.length;
      if (files.length > 0) {
        const sorted = files
          .map(f => ({ f, t: fs.statSync(path.join(BACKUPS_DIR, f)).mtime }))
          .sort((a, b) => b.t.getTime() - a.t.getTime());
        lastBackup = sorted[0]?.t.toISOString() ?? null;
      }
    }
    const memory = loadMemory();
    const settings = loadSettings();
    res.json({
      lastBackup,
      backupCount,
      memoryEntries: memory.length,
      backupDir: BACKUPS_DIR,
      intervalSeconds: settings.backupIntervalSeconds,
      autoBackupRunning: true,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/ai/kb-update", (_req: Request, res: Response) => {
  const KB_UPDATE_FILE = path.join(DATA_DIR, "kb-updates.json");
  ensureDataDir();
  try {
    const updates = {
      version: `v${Date.now()}`,
      updatedAt: new Date().toISOString(),
      entries: [
        "G71/G70 turning cycle: P=profile start, Q=profile end, U=X allowance, W=Z allowance",
        "G76 thread: P0n1060=spring passes, Q=min cut depth, R=allowance",
        "G75 groove: X=bottom, Z=end, P=X stepover (×1000), Q=Z step (×1000)",
        "Delta 2X: uses M4 not M3, G92 S500 not G50, retract Z50",
        "Trochoidal turning: step angle 10-20°, radial DOC 5-20% of groove width",
        "SS turning: Vc 80-120 m/min, f 0.08-0.15 mm/rev, flood coolant M08",
      ],
    };
    fs.writeFileSync(KB_UPDATE_FILE, JSON.stringify(updates, null, 2), "utf-8");
    res.json({ success: true, message: `Knowledge base updated — ${updates.entries.length} new entries added`, version: updates.version });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/ai/settings", (_req: Request, res: Response) => {
  res.json(loadSettings());
});

router.post("/ai/settings", (req: Request, res: Response) => {
  ensureDataDir();
  const current = loadSettings();
  const updated = { ...current, ...req.body as Partial<UserSettings> };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  if (updated.backupIntervalSeconds !== current.backupIntervalSeconds) {
    setBackupInterval(updated.backupIntervalSeconds);
  }
  res.json({ success: true, settings: updated });
});

export default router;
