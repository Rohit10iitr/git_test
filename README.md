# Crustdata Multi-Tenant MCP Proxy

A Node.js/TypeScript server that exposes [Crustdata](https://crustdata.com) APIs as an
[MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server via Server-Sent Events.

Each customer gets a **unique SSE URL** — they plug it into Claude Desktop (or any MCP client)
and immediately have access to company & people intelligence tools, without ever seeing
your Crustdata API keys.

```
https://your-host.com/mcp/acme-corp/sse
https://your-host.com/mcp/beta-inc/sse
```

---

## Table of Contents

1. [Architecture](#architecture)
2. [Quick Start (Local)](#quick-start-local)
3. [Adding Customers](#adding-customers)
4. [Available MCP Tools](#available-mcp-tools)
5. [Security Model](#security-model)
6. [Rate Limiting](#rate-limiting)
7. [Deploying to Production](#deploying-to-production)
   - [Railway](#railway)
   - [Render](#render)
   - [Fly.io](#flyio)
   - [Vercel (limited)](#vercel-limited)
8. [Connecting Claude Desktop](#connecting-claude-desktop)
9. [Environment Variables](#environment-variables)
10. [Project Structure](#project-structure)
11. [Troubleshooting](#troubleshooting)

---

## Architecture

```
Claude Desktop / API client
        │  GET /mcp/<CUSTOMER_ID>/sse       (SSE stream)
        │  POST /mcp/<CUSTOMER_ID>/messages  (JSON-RPC frames)
        ▼
┌───────────────────────────────────┐
│  MCP Proxy Server (this repo)     │
│                                   │
│  1. Validates CUSTOMER_ID         │
│  2. Looks up Crustdata API key    │
│  3. Checks rate limit             │
│  4. Spins up MCP Server instance  │
│  5. Proxies tool calls →          │
└───────────────────────────────────┘
        │  Authorization: Token <API_KEY>
        ▼
   Crustdata REST API
   (api.crustdata.com)
```

The API key is **injected server-side** — the MCP client never sees it.

---

## Quick Start (Local)

### Prerequisites

- Node.js >= 18
- A Crustdata API key (get one at [crustdata.com](https://crustdata.com))

### Steps

```bash
# 1. Clone and install
git clone <this-repo>
cd crustdata-mcp-proxy
npm install

# 2. Copy the example env file
cp .env.example .env

# 3. Fill in your customer API keys in customers.json
#    (see "Adding Customers" below)

# 4. Build and run
npm run build
npm start

# Or in dev mode (no build step, hot reload)
npm run dev
```

The server will start on `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/health
# {"status":"ok","activeSessions":0,"timestamp":"..."}
```

---

## Adding Customers

Edit **`customers.json`** in the project root:

```jsonc
{
  "customers": {
    // Key = the CUSTOMER_ID used in the URL
    "acme-corp": {
      "name": "Acme Corp",               // shown in server logs only
      "apiKey": "crust_live_...",        // their dedicated Crustdata key
      "enabled": true,                   // set false to suspend without deleting
      "rateLimit": {
        "requestsPerMinute": 60          // optional — overrides the default (60)
      }
    },
    "new-customer-xyz": {
      "name": "New Customer XYZ",
      "apiKey": "crust_live_...",
      "enabled": true
    }
  }
}
```

**Their MCP URL will be:**
```
https://your-host.com/mcp/new-customer-xyz/sse
```

### Production deployments (no file access)

On platforms like Railway or Render, set the `CUSTOMER_CONFIG` environment variable
to the **entire JSON string** of `customers.json`:

```
CUSTOMER_CONFIG={"customers":{"acme-corp":{"name":"Acme Corp","apiKey":"crust_live_...","enabled":true}}}
```

> **Note:** The server caches the config in memory after the first load.
> Restart the process after editing `customers.json` or updating `CUSTOMER_CONFIG`.

---

## Available MCP Tools

| Tool | Description | Credits |
|------|-------------|---------|
| `search_companies` | Screen companies by industry, headcount, funding, growth, etc. | 1 / 100 results |
| `search_people` | Search people by title, company, seniority, location, skills | 3 / 100 results |
| `get_company_details` | Full company enrichment: funding, headcount trends, traffic, founders | 1 / company |
| `enrich_person` | Full person profile by LinkedIn URL or business email | 3 / profile |
| `get_job_listings` | Job listings filtered by company, title, location, date | 1 / result |
| `identify_company` | Find a company's Crustdata ID by name, domain, or LinkedIn URL | **Free** |
| `get_company_linkedin_posts` | Recent LinkedIn posts from a company (real-time) | 1 / post |
| `get_person_linkedin_posts` | Recent LinkedIn posts from a person (real-time) | 1 / post |
| `search_linkedin_posts` | Search LinkedIn posts by keyword | 1 / post |
| `search_companies_realtime` | Real-time LinkedIn company search by headcount, industry, region | 1 / company |
| `search_people_realtime` | Real-time LinkedIn people search by title, company, seniority | 1 / profile |

---

## Security Model

| Concern | How it is handled |
|---------|-----------------|
| API key exposure | Keys live only in `customers.json` / env var. They are injected as HTTP headers server-side and never forwarded to the MCP client. |
| Tenant isolation | Each SSE session is bound to a specific `CUSTOMER_ID`. The POST `/messages` endpoint validates the customer ID against the stored session, preventing cross-tenant message injection. |
| Customer ID safety | IDs are validated against `^[a-zA-Z0-9_-]+$` to prevent path traversal or injection attacks. |
| Disabled customers | Set `"enabled": false` to immediately block all new and existing connections for a customer. |
| Rate limiting | Per-customer sliding-window limiter (in-memory). Replace with Redis for multi-replica deployments. |

---

## Rate Limiting

The default limit is **60 requests per minute** per customer, applied to both the SSE
connection setup and each incoming JSON-RPC message.

Override per customer in `customers.json`:

```jsonc
{
  "customers": {
    "high-volume-client": {
      "apiKey": "...",
      "rateLimit": { "requestsPerMinute": 200 }
    },
    "trial-user": {
      "apiKey": "...",
      "rateLimit": { "requestsPerMinute": 10 }
    }
  }
}
```

When a customer is rate-limited, the server responds with HTTP `429` and a
`retryAfterMs` field indicating how long to wait.

> **Multi-replica note:** The in-memory limiter does not synchronise across
> multiple server instances. For horizontally-scaled deployments, swap out
> `RateLimiter` in `src/rate-limiter.ts` for a Redis-backed implementation
> (e.g. using `ioredis` + a sliding-window Lua script).

---

## Deploying to Production

### Railway

Railway is the easiest option — it handles build, deploy, and HTTPS automatically.

1. Push this repo to GitHub.
2. Create a new project at [railway.app](https://railway.app) → **Deploy from GitHub repo**.
3. Railway auto-detects Node.js via `railway.toml`.
4. Add environment variables in the Railway dashboard:
   - `PORT` → `3000`
   - `CUSTOMER_CONFIG` → paste your JSON
5. Click **Deploy**. Railway gives you a public HTTPS URL.

Customer URLs:
```
https://<your-railway-app>.up.railway.app/mcp/acme-corp/sse
```

---

### Render

1. Push to GitHub.
2. Go to [render.com](https://render.com) → **New → Web Service** → connect your repo.
3. Render reads `render.yaml` automatically.
4. In the dashboard, fill in the `CUSTOMER_CONFIG` secret env var.
5. Deploy.

---

### Fly.io

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly launch --name crustdata-mcp-proxy
fly secrets set CUSTOMER_CONFIG='{"customers":{...}}'
fly deploy
```

---

### Vercel (limited)

> **Warning:** Vercel Serverless Functions have a maximum execution time of 10-60 seconds
> depending on your plan. SSE connections that stay open longer than that will be terminated.
> Use Railway, Render, or Fly.io for reliable SSE support.

---

## Connecting Claude Desktop

Add the following block to your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```jsonc
{
  "mcpServers": {
    "crustdata": {
      "url": "https://your-host.com/mcp/YOUR_CUSTOMER_ID/sse"
    }
  }
}
```

Restart Claude Desktop. The Crustdata tools will appear in the tool picker.

### What to send each customer

```
Your Crustdata MCP endpoint:
  https://your-host.com/mcp/acme-corp/sse

Add it to Claude Desktop:
  Settings → Developer → MCP Servers
  Name: Crustdata
  URL:  https://your-host.com/mcp/acme-corp/sse
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port to listen on. |
| `CUSTOMER_CONFIG` | _(empty)_ | Full `customers.json` JSON as a string. Takes priority over the file. |
| `CUSTOMERS_CONFIG_PATH` | `./customers.json` | Path to the customers JSON file (used when `CUSTOMER_CONFIG` is not set). |

---

## Project Structure

```
crustdata-mcp-proxy/
├── src/
│   ├── server.ts          # Express server + SSE/POST endpoints + routing
│   ├── tools.ts           # MCP tool definitions + Crustdata API call handlers
│   ├── customers.ts       # Customer config loader and lookup
│   └── rate-limiter.ts    # Per-customer sliding-window rate limiter
│
├── customers.json         # Customer -> API key mapping (replace placeholders!)
├── .env.example           # Copy to .env for local development
├── .gitignore
├── package.json
├── tsconfig.json
├── railway.toml           # Railway deployment config
└── render.yaml            # Render deployment config
```

---

## Troubleshooting

**`401 Unknown or disabled customer ID`**
- Check the customer ID in the URL matches a key in `customers.json`.
- Make sure `"enabled"` is `true` (or omitted).
- If using `CUSTOMER_CONFIG`, verify the JSON is valid.

**`429 Rate limit exceeded`**
- The customer is sending too many requests. Increase `requestsPerMinute` in
  `customers.json` or wait for the window to reset.

**SSE connection drops immediately**
- Verify your hosting platform supports long-lived HTTP connections (SSE).
  Vercel does **not** — use Railway or Render instead.

**`Tool error: Crustdata API error 401`**
- The `apiKey` for this customer is invalid or expired.
- Regenerate the key in your Crustdata dashboard, then update `customers.json`
  or `CUSTOMER_CONFIG` and restart the server.

**`Tool error: Crustdata API error 402` / credit errors**
- The customer's Crustdata account is out of credits. Top up the account or
  swap in a different API key.

**Config changes not taking effect**
- The config is loaded once and cached. Restart the server (or trigger a new
  deploy on Railway/Render) after editing `customers.json` or the env var.