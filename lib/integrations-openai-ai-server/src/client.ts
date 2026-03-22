import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

if (!baseURL || !apiKey) {
  console.warn(
    "AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY not set. AI features will be unavailable.",
  );
}

export const openai = baseURL && apiKey
  ? new OpenAI({ apiKey, baseURL })
  : (null as unknown as OpenAI);
