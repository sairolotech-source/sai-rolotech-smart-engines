import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const openaiBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const geminiApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const geminiBaseURL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
const anthropicApiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
const anthropicBaseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

let _openai: OpenAI | null = null;
let _provider: "openai" | "gemini" | "none" = "none";

if (openaiBaseURL && openaiApiKey) {
  _openai = new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseURL });
  _provider = "openai";
  console.log("[AI] Using OpenAI provider (gpt-5.2 / gpt-5.3-codex available)");
} else if (geminiApiKey) {
  _openai = new OpenAI({ apiKey: geminiApiKey, baseURL: geminiBaseURL });
  _provider = "gemini";
  console.log("[AI] Using Gemini provider (OpenAI-compatible mode)");
} else {
  console.warn("[AI] No AI API keys set. AI chat features will be unavailable.");
}

let _anthropic: Anthropic | null = null;
if (anthropicApiKey) {
  _anthropic = new Anthropic({
    apiKey: anthropicApiKey,
    ...(anthropicBaseURL ? { baseURL: anthropicBaseURL } : {}),
  });
  console.log("[AI] Claude provider ready (claude-sonnet-4-6 / claude-opus-4-6 available)");
} else {
  console.warn("[AI] No Anthropic API key set. Claude features will be unavailable.");
}

export const openai = _openai as OpenAI;
export const aiProvider = _provider;
export const anthropic = _anthropic as Anthropic;
export const hasAnthropicKey = !!anthropicApiKey;
