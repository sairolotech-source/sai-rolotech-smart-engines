import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const openaiBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const geminiApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const geminiBaseURL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const anthropicApiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
const anthropicBaseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

let _openai: OpenAI | null = null;
let _provider: "openai" | "gemini" | "none" = "none";

if (openaiBaseURL && openaiApiKey) {
  _openai = new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseURL });
  _provider = "openai";
  console.log("[AI] OpenAI provider ready (gpt-5.2 / gpt-5.3-codex)");
} else if (geminiApiKey) {
  const fallbackURL = geminiBaseURL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
  _openai = new OpenAI({ apiKey: geminiApiKey, baseURL: fallbackURL });
  _provider = "gemini";
  console.log("[AI] Gemini provider ready (OpenAI-compatible mode)");
} else {
  console.warn("[AI] No OpenAI/Gemini API keys set. Chat features unavailable.");
}

let _anthropic: Anthropic | null = null;
if (anthropicApiKey) {
  _anthropic = new Anthropic({
    apiKey: anthropicApiKey,
    ...(anthropicBaseURL ? { baseURL: anthropicBaseURL } : {}),
  });
  console.log("[AI] Claude provider ready (claude-opus-4-6 / claude-sonnet-4-6)");
} else {
  console.warn("[AI] No Anthropic key. Claude features unavailable.");
}

let _gemini: GoogleGenAI | null = null;
if (geminiApiKey) {
  _gemini = new GoogleGenAI({
    apiKey: geminiApiKey,
    ...(geminiBaseURL ? { httpOptions: { apiVersion: "", baseUrl: geminiBaseURL } } : {}),
  });
  console.log("[AI] Gemini native provider ready (gemini-3.1-pro-preview / gemini-2.5-pro)");
} else {
  console.warn("[AI] No Gemini key. Native Gemini features unavailable.");
}

export const openai = _openai as OpenAI;
export const aiProvider = _provider;
export const anthropic = _anthropic as Anthropic;
export const gemini = _gemini as GoogleGenAI;
export const hasAnthropicKey = !!anthropicApiKey;
export const hasGeminiKey = !!geminiApiKey;
export const hasOpenAIKey = !!openaiApiKey;
