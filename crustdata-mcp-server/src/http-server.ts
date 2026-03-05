#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { CrustdataClient } from "./client.js";
import { registerCompanyTools } from "./tools/company.js";
import { registerPeopleTools } from "./tools/people.js";
import { registerWatcherAuxiliaryTools } from "./tools/watcher-auxiliary.js";

const apiKey = process.env.CRUSTDATA_API_KEY;
if (!apiKey) {
  console.error("CRUSTDATA_API_KEY environment variable is required");
  process.exit(1);
}

function createServer(): McpServer {
  const server = new McpServer({
    name: "crustdata",
    version: "1.0.0",
  });
  const client = new CrustdataClient(apiKey!);
  registerCompanyTools(server, client);
  registerPeopleTools(server, client);
  registerWatcherAuxiliaryTools(server, client);
  return server;
}

const app = express();
app.use(express.json());

// CORS - needed for browser-based clients
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, Last-Event-ID");
  res.header("Access-Control-Expose-Headers", "mcp-session-id");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --- Streamable HTTP transport (modern MCP protocol) ---

const streamableTransports: Record<string, StreamableHTTPServerTransport> = {};

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && streamableTransports[sessionId]) {
      transport = streamableTransports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          streamableTransports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) delete streamableTransports[sid];
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !streamableTransports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await streamableTransports[sessionId].handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !streamableTransports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await streamableTransports[sessionId].handleRequest(req, res);
});

// --- Legacy SSE transport (for clients that don't support Streamable HTTP) ---

const sseTransports: Record<string, SSEServerTransport> = {};

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sid = transport.sessionId;
  sseTransports[sid] = transport;

  transport.onclose = () => {
    delete sseTransports[sid];
  };

  const server = createServer();
  await server.connect(transport);
  console.log(`SSE session established: ${sid}`);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId || !sseTransports[sessionId]) {
    res.status(404).send("Session not found");
    return;
  }
  await sseTransports[sessionId].handlePostMessage(req, res, req.body);
});

// Start server
const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, () => {
  console.log(`Crustdata MCP HTTP server running on http://localhost:${PORT}`);
  console.log(`  Streamable HTTP: POST/GET/DELETE http://localhost:${PORT}/mcp`);
  console.log(`  Legacy SSE:      GET http://localhost:${PORT}/sse`);
  console.log(`  Health check:    GET http://localhost:${PORT}/health`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  for (const t of Object.values(streamableTransports)) await t.close().catch(() => {});
  for (const t of Object.values(sseTransports)) await t.close().catch(() => {});
  process.exit(0);
});
