# Crustdata MCP Server

A local MCP (Model Context Protocol) server that exposes all Crustdata APIs as tools for Claude Desktop. This lets you use Claude as a live B2B research and sales intelligence tool.

## What it does

Connects Claude Desktop to Crustdata's live database so you can ask things like:
- "Find me CTOs at Series A fintech companies in New York"
- "Get me info on stripe.com"
- "Search for software engineers in San Francisco who recently changed jobs"
- "What are the latest LinkedIn posts from OpenAI?"
- "Alert me when someone at a specific company changes jobs"

## 20 Tools Included

| Tool | Description | Credits |
|------|-------------|---------|
| `crustdata_identify_company` | Find a company by name/domain/LinkedIn URL | FREE |
| `crustdata_enrich_company` | Full company data (headcount, funding, traffic, etc.) | 1/company |
| `crustdata_search_companies` | Search CompanyDB with rich filters | varies |
| `crustdata_search_companies_realtime` | Real-time LinkedIn company search | 1/result |
| `crustdata_autocomplete_company_field` | Get valid CompanyDB filter values | FREE |
| `crustdata_autocomplete_filter` | Get valid LinkedIn filter values | FREE |
| `crustdata_enrich_person` | Full person profile by LinkedIn URL or email | 3/profile |
| `crustdata_search_people` | Search PersonDB with rich filters | 3/100 |
| `crustdata_search_people_realtime` | Real-time LinkedIn people search | varies |
| `crustdata_autocomplete_person_field` | Get valid PersonDB filter values | FREE |
| `crustdata_get_company_linkedin_posts` | Get a company's LinkedIn posts | 1/post |
| `crustdata_get_person_linkedin_posts` | Get a person's LinkedIn posts | 1/post |
| `crustdata_search_linkedin_posts_by_keyword` | Search LinkedIn posts by keyword | 1/post |
| `crustdata_get_job_listings` | Search job listings | 1/result |
| `crustdata_create_watch` | Set up real-time webhooks | varies |
| `crustdata_simulate_watch` | Test webhooks before going live | FREE |
| `crustdata_get_task_result` | Poll background task results | FREE |
| `crustdata_check_credits` | Check your credit balance | FREE |
| `crustdata_web_search` | Web search via Crustdata | 1/query |
| `crustdata_web_fetch` | Fetch and extract content from URLs | varies |

## Setup (Step by Step)

### Prerequisites
- **Node.js** v18+ — check with `node --version`. Download from [nodejs.org](https://nodejs.org) if needed.
- **Claude Desktop app** — download from [claude.ai/download](https://claude.ai/download)
- **Crustdata API key** — get one at [crustdata.com](https://crustdata.com)

### Step 1: Clone and build

```bash
git clone <this-repo-url>
cd crustdata-mcp-server
npm install
npm run build
```

### Step 2: Configure Claude Desktop

Open (or create) the Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this to the file (update the path and API key):

```json
{
  "mcpServers": {
    "crustdata": {
      "command": "node",
      "args": ["/absolute/path/to/crustdata-mcp-server/dist/index.js"],
      "env": {
        "CRUSTDATA_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

If you already have content in this file (like `"preferences"`), just add the `"mcpServers"` section alongside it.

### Step 3: Restart Claude Desktop

Fully quit Claude Desktop (`Cmd+Q` on Mac) and reopen it. You should see the tools available when you start a new chat.

### Step 4: Test it

Try asking Claude: **"Check my Crustdata credits"**

If it returns your credit balance, everything is working.
