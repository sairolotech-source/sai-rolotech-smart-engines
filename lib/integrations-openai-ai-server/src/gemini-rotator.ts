import { GoogleGenAI } from "@google/genai";

interface KeyStatus {
  key: string;
  index: number;
  exhausted: boolean;
  exhaustedAt: number | null;
  requestCount: number;
  errorCount: number;
}

const RESET_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

class GeminiKeyRotator {
  private keys: KeyStatus[] = [];
  private currentIndex: number = 0;
  private clients: Map<number, GoogleGenAI> = new Map();

  constructor() {
    this.loadKeys();
  }

  private loadKeys() {
    // Load up to 6 personal Gemini keys — accepts both GOOGLE_API_KEY_N and GEMINI_KEY_N
    for (let i = 1; i <= 6; i++) {
      const key = process.env[`GOOGLE_API_KEY_${i}`] ?? process.env[`GEMINI_KEY_${i}`];
      if (key && key.trim().length > 0) {
        const idx = this.keys.length;
        this.keys.push({
          key: key.trim(),
          index: idx,
          exhausted: false,
          exhaustedAt: null,
          requestCount: 0,
          errorCount: 0,
        });
        this.clients.set(idx, new GoogleGenAI({ apiKey: key.trim() }));
      }
    }

    // Fallback: also try Replit integration key as last resort
    const replitKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    const replitBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
    if (replitKey) {
      const idx = this.keys.length;
      this.keys.push({
        key: replitKey,
        index: idx,
        exhausted: false,
        exhaustedAt: null,
        requestCount: 0,
        errorCount: 0,
      });
      this.clients.set(
        idx,
        new GoogleGenAI({
          apiKey: replitKey,
          ...(replitBase ? { httpOptions: { apiVersion: "", baseUrl: replitBase } } : {}),
        })
      );
    }

    if (this.keys.length === 0) {
      console.warn("[GeminiRotator] No Gemini keys found. Add GEMINI_KEY_1 to GEMINI_KEY_6.");
    } else {
      console.log(
        `[GeminiRotator] ${this.keys.length} key(s) loaded. Model: gemini-2.5-flash`
      );
    }
  }

  private resetExpiredKeys() {
    const now = Date.now();
    for (const status of this.keys) {
      if (status.exhausted && status.exhaustedAt) {
        if (now - status.exhaustedAt >= RESET_AFTER_MS) {
          status.exhausted = false;
          status.exhaustedAt = null;
          status.errorCount = 0;
          console.log(`[GeminiRotator] Key #${status.index + 1} reset after 24h`);
        }
      }
    }
  }

  private getActiveKey(): KeyStatus | null {
    this.resetExpiredKeys();
    const available = this.keys.filter((k) => !k.exhausted);
    if (available.length === 0) return null;

    // Find current or next available
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      if (!this.keys[idx].exhausted) {
        this.currentIndex = idx;
        return this.keys[idx];
      }
    }
    return null;
  }

  private markExhausted(index: number) {
    const status = this.keys[index];
    if (!status) return;
    status.exhausted = true;
    status.exhaustedAt = Date.now();
    console.warn(`[GeminiRotator] Key #${index + 1} exhausted — rotating to next`);

    // Rotate to next available
    for (let i = 1; i <= this.keys.length; i++) {
      const nextIdx = (index + i) % this.keys.length;
      if (!this.keys[nextIdx].exhausted) {
        this.currentIndex = nextIdx;
        console.log(`[GeminiRotator] Switched to Key #${nextIdx + 1}`);
        return;
      }
    }
    console.error("[GeminiRotator] ALL keys exhausted! Will retry after 24h reset.");
  }

  private isRateLimitError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      msg.includes("429") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("quota") ||
      msg.includes("rate limit") ||
      msg.toLowerCase().includes("too many requests")
    );
  }

  // Main method: generate content with auto key rotation
  async generateContent(params: {
    model?: string;
    contents: string | object;
    config?: object;
  }): Promise<string> {
    const model = params.model ?? "gemini-2.5-flash";

    for (let attempt = 0; attempt < this.keys.length + 1; attempt++) {
      const status = this.getActiveKey();

      if (!status) {
        throw new Error("[GeminiRotator] All Gemini keys exhausted. Try again in 24 hours.");
      }

      const client = this.clients.get(status.index)!;
      status.requestCount++;

      try {
        const response = await client.models.generateContent({
          model,
          contents: params.contents as any,
          config: params.config as any,
        });

        const text = response.text ?? "";
        return text;
      } catch (error) {
        status.errorCount++;

        if (this.isRateLimitError(error)) {
          this.markExhausted(status.index);
          // Retry with next key
          continue;
        }

        // Non-rate-limit error — throw immediately
        throw error;
      }
    }

    throw new Error("[GeminiRotator] Failed after trying all keys.");
  }

  // Stream content with auto key rotation
  async *generateContentStream(params: {
    model?: string;
    contents: string | object;
    config?: object;
  }): AsyncGenerator<string> {
    const model = params.model ?? "gemini-2.5-flash";

    for (let attempt = 0; attempt < this.keys.length + 1; attempt++) {
      const status = this.getActiveKey();

      if (!status) {
        throw new Error("[GeminiRotator] All Gemini keys exhausted. Try again in 24 hours.");
      }

      const client = this.clients.get(status.index)!;
      status.requestCount++;

      try {
        const stream = await client.models.generateContentStream({
          model,
          contents: params.contents as any,
          config: params.config as any,
        });

        for await (const chunk of stream) {
          yield chunk.text ?? "";
        }
        return; // success
      } catch (error) {
        status.errorCount++;

        if (this.isRateLimitError(error)) {
          this.markExhausted(status.index);
          continue;
        }

        throw error;
      }
    }

    throw new Error("[GeminiRotator] Stream failed after trying all keys.");
  }

  // Get status of all keys (for dashboard/monitoring)
  getStatus(): object[] {
    return this.keys.map((k, i) => ({
      key: `Key #${i + 1}`,
      active: !k.exhausted && this.currentIndex === i,
      exhausted: k.exhausted,
      requestCount: k.requestCount,
      errorCount: k.errorCount,
      resetsAt: k.exhaustedAt
        ? new Date(k.exhaustedAt + RESET_AFTER_MS).toISOString()
        : null,
    }));
  }

  get totalKeys(): number {
    return this.keys.length;
  }

  get activeKeys(): number {
    return this.keys.filter((k) => !k.exhausted).length;
  }
}

// Singleton instance
export const geminiRotator = new GeminiKeyRotator();
