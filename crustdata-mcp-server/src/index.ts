#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CrustdataClient } from "./client.js";
import { registerCompanyTools } from "./tools/company.js";
import { registerPeopleTools } from "./tools/people.js";
import { registerWatcherAuxiliaryTools } from "./tools/watcher-auxiliary.js";

const apiKey = process.env.CRUSTDATA_API_KEY;
if (!apiKey) {
  console.error("CRUSTDATA_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "crustdata",
  version: "1.0.0",
});

const client = new CrustdataClient(apiKey);

registerCompanyTools(server, client);
registerPeopleTools(server, client);
registerWatcherAuxiliaryTools(server, client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Crustdata MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
