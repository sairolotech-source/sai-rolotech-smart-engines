/**
 * CloudConnectors — wrapper around @replit/connectors-sdk
 * Google Drive, and other Replit-managed OAuth connectors ke liye
 */
import { ReplitConnectors } from "@replit/connectors-sdk";

export interface ProxyOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
}

export class CloudConnectors {
  private sdk: ReplitConnectors;

  constructor() {
    this.sdk = new ReplitConnectors();
  }

  async proxy(service: string, endpoint: string, options: ProxyOptions): Promise<Response> {
    try {
      return await this.sdk.proxy(service, endpoint, options);
    } catch {
      return new Response(JSON.stringify({ error: "Cloud connector unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  async isServiceAvailable(service: string): Promise<boolean> {
    try {
      const res = await this.sdk.proxy(service, "/drive/v3/about?fields=user", { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }
}
