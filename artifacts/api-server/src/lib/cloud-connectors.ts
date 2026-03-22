export interface ProxyOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
}

export class CloudConnectors {
  private connectorsUrl: string;

  constructor() {
    this.connectorsUrl = process.env["REPLIT_CONNECTORS_URL"] ?? "https://api.replit.com/v0/connectors";
  }

  async proxy(service: string, endpoint: string, options: ProxyOptions): Promise<Response> {
    const token = process.env["REPLIT_DB_URL"];
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    };

    if (token) {
      headers["X-Platform-Token"] = token;
    }

    try {
      const url = `${this.connectorsUrl}/${service}${endpoint}`;
      const res = await fetch(url, {
        method: options.method,
        headers,
        body: options.body,
      });
      return res;
    } catch {
      return new Response(JSON.stringify({ error: "Cloud connector unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  async isServiceAvailable(service: string): Promise<boolean> {
    try {
      const res = await this.proxy(service, "/", { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }
}
