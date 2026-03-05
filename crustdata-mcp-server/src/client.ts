import fetch from "node-fetch";

const BASE_URL = "https://api.crustdata.com";

export class CrustdataClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async get(path: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Crustdata API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async post(path: string, body: any, queryParams?: Record<string, string>): Promise<any> {
    const url = new URL(`${BASE_URL}${path}`);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Crustdata API error ${res.status}: ${text}`);
    }
    return res.json();
  }
}
