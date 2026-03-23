import OpenAI from "openai";

const openaiBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const geminiApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const geminiBaseURL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";

let _openai: OpenAI | null = null;
let _provider: "openai" | "gemini" | "none" = "none";

if (openaiBaseURL && openaiApiKey) {
  _openai = new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseURL });
  _provider = "openai";
  console.log("[AI] Using OpenAI provider");
} else if (geminiApiKey) {
  _openai = new OpenAI({ apiKey: geminiApiKey, baseURL: geminiBaseURL });
  _provider = "gemini";
  console.log("[AI] Using Gemini provider (OpenAI-compatible mode)");
} else {
  console.warn("[AI] No AI API keys set. AI chat features will be unavailable.");
}

export const openai = _openai as OpenAI;
export const aiProvider = _provider;
