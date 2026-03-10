/**
 * test-queries.ts
 *
 * Runs two real-world sales queries through Claude Opus 4.6 + Crustdata tools.
 * Execute with: npx tsx test-queries.ts
 */

import Anthropic from '@anthropic-ai/sdk';

// ─── Config ──────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CRUSTDATA_API_KEY = process.env.CRUSTDATA_API_KEY;

if (!ANTHROPIC_API_KEY) throw new Error('Set ANTHROPIC_API_KEY env var');
if (!CRUSTDATA_API_KEY) throw new Error('Set CRUSTDATA_API_KEY env var (use the key from customers.json for your customer)');
const CRUSTDATA_BASE = 'https://api.crustdata.com';

// ─── Crustdata API helpers ───────────────────────────────────────────────────

async function postCrustdata(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${CRUSTDATA_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${CRUSTDATA_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Crustdata ${res.status} ${path}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function getCrustdata(path: string, params: Record<string, unknown>): Promise<unknown> {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString();
  const url = `${CRUSTDATA_BASE}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Token ${CRUSTDATA_API_KEY}`, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Crustdata ${res.status} ${path}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    let result: unknown;
    switch (name) {
      case 'search_companies':
        result = await postCrustdata('/screener/company/search', input); break;
      case 'search_people':
        result = await postCrustdata('/screener/persondb/search', input); break;
      case 'get_company_details':
        result = await getCrustdata('/screener/company', input); break;
      case 'enrich_person':
        result = await getCrustdata('/screener/person/enrich', input); break;
      case 'get_job_listings':
        result = await postCrustdata('/data_lab/job_listings/Table/', {
          tickers: [], dataset: { name: 'job_listings', id: 'joblisting' },
          filters: input.filters, offset: input.offset ?? 0,
          limit: input.limit ?? 100, sorts: input.sorts ?? [],
          ...(input.sync_from_source !== undefined && { sync_from_source: input.sync_from_source }),
        }); break;
      case 'identify_company':
        result = await postCrustdata('/screener/identify/', input); break;
      case 'get_company_linkedin_posts':
        result = await getCrustdata('/screener/linkedin_posts', input); break;
      case 'get_person_linkedin_posts': {
        const params = { ...input };
        if (params.linkedin_profile_url) {
          params.person_linkedin_url = params.linkedin_profile_url;
          delete params.linkedin_profile_url;
        }
        result = await getCrustdata('/screener/social_posts', params); break;
      }
      case 'search_linkedin_posts':
        result = await postCrustdata('/screener/linkedin_posts/keyword_search/', input); break;
      case 'search_companies_realtime':
        result = await postCrustdata('/screener/company/search', input); break;
      case 'search_people_realtime':
        result = await postCrustdata('/screener/person/search', input); break;
      default:
        return `Unknown tool: ${name}`;
    }
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Tool definitions (mirrors tools.ts) ─────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_companies',
    description: 'Search and screen companies from the Crustdata database using filters like industry, headcount, growth, funding stage, location.',
    input_schema: {
      type: 'object',
      properties: {
        filters: { type: 'object', description: 'Filter object. Single: {filter_type, type, value}. Combined: {op:"and"|"or", conditions:[…]}.' },
        limit: { type: 'integer', default: 20 },
        cursor: { type: 'string' },
        sorts: { type: 'array', items: { type: 'object' } },
      },
    },
  },
  {
    name: 'search_people',
    description: 'Search people in the Crustdata database by title, company, seniority, location, skills, years of experience.',
    input_schema: {
      type: 'object',
      properties: {
        filters: { type: 'object', description: 'Filter object. Key columns: current_employers.title, current_employers.seniority_level, current_employers.name, location_country, etc.' },
        limit: { type: 'integer', default: 20 },
        cursor: { type: 'string' },
      },
    },
  },
  {
    name: 'get_company_details',
    description: 'Enrich company data by domain, name, LinkedIn URL, or Crustdata ID. Returns firmographics, headcount, funding, revenue, job openings, founders, CXOs.',
    input_schema: {
      type: 'object',
      properties: {
        company_domain: { type: 'string' },
        company_name: { type: 'string' },
        company_linkedin_url: { type: 'string' },
        company_id: { type: 'string' },
        fields: { type: 'string', description: 'Extra sections: headcount, funding_and_investment, job_openings, cxos, decision_makers, estimated_revenue_timeseries, web_traffic, etc.' },
        enrich_realtime: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'enrich_person',
    description: 'Enrich a person profile by LinkedIn URL or business email. Returns employment history, education, skills, emails.',
    input_schema: {
      type: 'object',
      properties: {
        linkedin_profile_url: { type: 'string' },
        business_email: { type: 'string' },
        fields: { type: 'string' },
        enrich_realtime: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'identify_company',
    description: 'FREE. Identify a company by name, domain, or LinkedIn URL. Returns Crustdata company_id for use in other tools.',
    input_schema: {
      type: 'object',
      properties: {
        query_company_name: { type: 'string' },
        query_company_website: { type: 'string' },
        query_company_linkedin_url: { type: 'string' },
        count: { type: 'integer', default: 10 },
      },
    },
  },
  {
    name: 'search_people_realtime',
    description: 'Search people in real-time from LinkedIn. Filter by CURRENT_COMPANY, CURRENT_TITLE, SENIORITY_LEVEL, REGION, FUNCTION, INDUSTRY, etc.',
    input_schema: {
      type: 'object',
      required: ['filters'],
      properties: {
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filter_type: { type: 'string' },
              type: { type: 'string' },
              value: {},
              fuzzy_match: { type: 'boolean' },
            },
          },
        },
        page: { type: 'integer', default: 1 },
      },
    },
  },
  {
    name: 'get_job_listings',
    description: 'Search job listings. Filter by company_id, title, location, date_updated.',
    input_schema: {
      type: 'object',
      required: ['filters'],
      properties: {
        filters: { type: 'object', required: ['op', 'conditions'], properties: { op: { type: 'string' }, conditions: { type: 'array' } } },
        limit: { type: 'integer', default: 100 },
        offset: { type: 'integer', default: 0 },
      },
    },
  },
];

// ─── Agentic loop ─────────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function runQuery(queryLabel: string, userQuery: string): Promise<void> {
  console.log('\n' + '═'.repeat(80));
  console.log(`  ${queryLabel}`);
  console.log('═'.repeat(80));
  console.log(`\nUser: ${userQuery}\n`);

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userQuery }];

  const system = `You are an expert sales intelligence assistant with access to Crustdata, a B2B data platform.
When the user asks to find people or companies, use the available tools to actually fetch real data.
For finding people at companies:
- Use identify_company first (free) to get company_id if you need to look up a specific company
- Use search_people or search_people_realtime to find decision-makers by title/seniority
- Use get_company_details with fields="cxos,decision_makers" to get company leadership
Return specific names, titles, LinkedIn URLs, and actionable insights from the real data.`;

  let iteration = 0;
  const MAX_ITERATIONS = 10;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`\n[Iteration ${iteration}] Calling Claude...`);

    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system,
      tools: TOOLS,
      messages,
    });

    // Stream text in real-time
    stream.on('text', (delta) => process.stdout.write(delta));

    const message = await stream.finalMessage();

    // Check stop reason
    if (message.stop_reason === 'end_turn') {
      console.log('\n\n[Done]\n');
      break;
    }

    if (message.stop_reason !== 'tool_use') {
      console.log(`\n[Stopped: ${message.stop_reason}]\n`);
      break;
    }

    // Handle tool calls
    const toolUseBlocks = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    messages.push({ role: 'assistant', content: message.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolCall of toolUseBlocks) {
      console.log(`\n[Tool call] ${toolCall.name}(${JSON.stringify(toolCall.input).slice(0, 120)}...)`);
      const result = await executeTool(toolCall.name, toolCall.input as Record<string, unknown>);
      // Truncate very large results to avoid context overflow
      const truncated = result.length > 15000 ? result.slice(0, 15000) + '\n... [truncated]' : result;
      console.log(`[Tool result] ${truncated.slice(0, 300)}${truncated.length > 300 ? '...' : ''}`);
      toolResults.push({ type: 'tool_result', tool_use_id: toolCall.id, content: truncated });
    }

    messages.push({ role: 'user', content: toolResults });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await runQuery(
    'Query 1: Find targets at large companies to sell Crustdata MCP server',
    'Find me the right targets at large companies who I can sell the Crustdata MCP server to. I need specific people with names, titles, and LinkedIn URLs.'
  );

  await runQuery(
    'Query 2: AWS seller targeting American Airlines',
    'I am an AWS seller being asked to sell AI products and I have no idea how to go about it. My customer is American Airlines - look at their priorities and find the top people in the market who have the authority, budget and willingness to buy AI products.'
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
