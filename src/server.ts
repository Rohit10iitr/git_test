/**
 * server.ts — Multi-tenant MCP Proxy Server for Crustdata
 *
 * Each customer gets a unique SSE endpoint:
 *   GET  /mcp/:customerId/sse      — client connects here (SSE stream)
 *   POST /mcp/:customerId/messages — client sends JSON-RPC messages here
 *
 * The server resolves the customer's Crustdata API key server-side
 * and injects it into every Crustdata API call — the key is never
 * visible to the connected MCP client.
 */

import 'dotenv/config';

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import { getCustomer, DEFAULT_RATE_LIMIT } from './customers.js';
import { RateLimiter } from './rate-limiter.js';
import { createMCPServer } from './tools.js';

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

// Parse JSON bodies for the POST /messages endpoint
app.use(express.json());

// Basic request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Shared state ─────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter();

/**
 * Maps sessionId → SSEServerTransport so POST /messages can route
 * incoming JSON-RPC frames to the right open SSE connection.
 */
const activeTransports = new Map<string, SSEServerTransport>();

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    activeSessions: activeTransports.size,
    timestamp: new Date().toISOString(),
  });
});

// ─── SSE endpoint — client opens a persistent connection here ─────────────────

app.get('/mcp/:customerId/sse', async (req: Request, res: Response) => {
  const { customerId } = req.params;

  // 1. Validate and look up customer
  const customer = getCustomer(customerId);
  if (!customer) {
    res.status(401).json({
      error: 'Unknown or disabled customer ID.',
    });
    return;
  }

  // 2. Rate limit check (counts as 1 connection setup)
  const rpm = customer.rateLimit?.requestsPerMinute ?? DEFAULT_RATE_LIMIT.requestsPerMinute;
  if (!rateLimiter.allow(customerId, rpm)) {
    const usage = rateLimiter.usage(customerId, rpm);
    res.status(429).json({
      error: 'Rate limit exceeded.',
      retryAfterMs: usage.resetsInMs,
    });
    return;
  }

  // 3. Create the MCP server instance bound to this customer's API key
  const mcpServer = createMCPServer(customer.apiKey);

  // 4. Create the SSE transport.
  //    The second argument is the path clients will POST messages to.
  const postEndpoint = `/mcp/${customerId}/messages`;
  const transport = new SSEServerTransport(postEndpoint, res);

  // 5. Register transport before connecting (messages may arrive immediately)
  activeTransports.set(transport.sessionId, transport);
  console.log(
    `[${customerId}] SSE session opened: ${transport.sessionId} (active: ${activeTransports.size})`,
  );

  // 6. Clean up when the client disconnects
  res.on('close', () => {
    activeTransports.delete(transport.sessionId);
    mcpServer.close().catch(() => undefined);
    console.log(
      `[${customerId}] SSE session closed: ${transport.sessionId} (active: ${activeTransports.size})`,
    );
  });

  // 7. Connect the MCP server to the transport — this sends the SSE headers
  //    and the initial "endpoint" event so the client knows where to POST.
  try {
    await mcpServer.connect(transport);
  } catch (err) {
    activeTransports.delete(transport.sessionId);
    console.error(`[${customerId}] Failed to connect MCP server:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to initialize MCP session.' });
    }
  }
});

// ─── POST endpoint — client sends JSON-RPC messages here ─────────────────────

app.post('/mcp/:customerId/messages', async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const sessionId = req.query['sessionId'] as string | undefined;

  // Validate customer (prevents session hijacking across tenants)
  const customer = getCustomer(customerId);
  if (!customer) {
    res.status(401).json({ error: 'Unknown or disabled customer ID.' });
    return;
  }

  if (!sessionId) {
    res.status(400).json({
      error: 'Missing required query parameter: sessionId.',
    });
    return;
  }

  const transport = activeTransports.get(sessionId);
  if (!transport) {
    res.status(404).json({
      error: `Session "${sessionId}" not found. It may have expired or never existed.`,
    });
    return;
  }

  // Rate limit POST messages too
  const rpm = customer.rateLimit?.requestsPerMinute ?? DEFAULT_RATE_LIMIT.requestsPerMinute;
  if (!rateLimiter.allow(customerId, rpm)) {
    const usage = rateLimiter.usage(customerId, rpm);
    res.status(429).json({
      error: 'Rate limit exceeded.',
      retryAfterMs: usage.resetsInMs,
    });
    return;
  }

  try {
    // Pass the already-parsed body so the transport doesn't try to re-parse
    await transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    console.error(`[${customerId}] Message handling error:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process message.' });
    }
  }
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  console.log('');
  console.log('  Crustdata Multi-Tenant MCP Proxy');
  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  Server listening on port ${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log(`  Pattern: http://localhost:${PORT}/mcp/[CUSTOMER_ID]/sse`);
  console.log('');
});
