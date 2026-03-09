/**
 * tools.ts — Crustdata MCP tool definitions + API call handlers.
 *
 * Each tool definition follows the MCP Tool schema.
 * Each handler makes an authenticated HTTP call to the Crustdata REST API,
 * injecting the customer's API key server-side (never visible to the client).
 *
 * Crustdata API reference: https://fulldocs.crustdata.com/
 * Auth header: "Authorization: Token <API_KEY>"
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

// ─── API client ──────────────────────────────────────────────────────────────

const CRUSTDATA_BASE_URL = 'https://api.crustdata.com';

async function callCrustdata(
  apiKey: string,
  path: string,
  body: unknown,
): Promise<unknown> {
  const url = `${CRUSTDATA_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Network error calling Crustdata: ${String(err)}`);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Crustdata API error ${response.status} ${response.statusText}: ${text}`,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Return raw text if the response isn't JSON
    return text;
  }
}

async function getCrustdata(
  apiKey: string,
  path: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }
  const qs = searchParams.toString();
  const url = `${CRUSTDATA_BASE_URL}${path}${qs ? `?${qs}` : ''}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Token ${apiKey}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    throw new Error(`Network error calling Crustdata: ${String(err)}`);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Crustdata API error ${response.status} ${response.statusText}: ${text}`,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
// Keep these in sync with the Crustdata API docs. The inputSchema drives the
// structured tool call that Claude sends to us.

const TOOL_DEFINITIONS: Tool[] = [
  // ── 1. Search Companies (database screener) ──────────────────────────────
  {
    name: 'search_companies',
    description:
      'Search and screen companies from the Crustdata database using rich filters: ' +
      'industry, headcount, growth, funding stage, location, revenue, investors, ' +
      'social metrics, and more. Returns paginated results with cursor-based pagination. ' +
      '1 credit per 100 results (max 1 000 per request).\n\n' +
      'Filter operators: = != in not_in > < => =< (.) [.]\n' +
      'Country codes: ISO 3-alpha (USA, GBR, IND, DEU, …)\n' +
      'Funding types: seed, series_a, series_b, series_c, …\n\n' +
      'Example — high-growth SaaS startups:\n' +
      '{"op":"and","conditions":[{"filter_type":"linkedin_industries","type":"(.)","value":"software"},{"filter_type":"employee_metrics.growth_6m_percent","type":">","value":20}]}',
    inputSchema: {
      type: 'object',
      properties: {
        filters: {
          type: 'object',
          description:
            'Filter object. Single condition: {filter_type, type, value}. ' +
            'Combined: {op:"and"|"or", conditions:[…]}. ' +
            'Available filter_type values: company_name, company_type, ' +
            'hq_country (ISO 3-alpha), hq_location, largest_headcount_country, ' +
            'linkedin_industries, crunchbase_categories, markets, ' +
            'employee_metrics.latest_count, employee_metrics.growth_6m_percent, ' +
            'employee_metrics.growth_12m_percent, employee_count_range, ' +
            'crunchbase_total_investment_usd, last_funding_round_type, ' +
            'last_funding_date, year_founded, company_website_domain, ' +
            'linkedin_profile_url, follower_metrics.latest_count, ' +
            'estimated_revenue_lower_bound_usd, estimated_revenue_higher_bound_usd, ' +
            'acquisition_status, crunchbase_investors, tracxn_investors.',
        },
        limit: {
          type: 'integer',
          description: 'Results per page (1–1 000, default 20).',
          default: 20,
          minimum: 1,
          maximum: 1000,
        },
        cursor: {
          type: 'string',
          description:
            'Pagination cursor returned in the previous response next_cursor field.',
        },
        sorts: {
          type: 'array',
          description: 'Sort criteria.',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              order: { type: 'string', enum: ['asc', 'desc'] },
            },
            required: ['column', 'order'],
          },
        },
      },
    },
  },

  // ── 2. Search People (database screener) ─────────────────────────────────
  {
    name: 'search_people',
    description:
      'Search people in the Crustdata database using rich filters. ' +
      'Filter by title, company, seniority level, location, skills, ' +
      'years of experience, and more. Supports cursor-based pagination. ' +
      '3 credits per 100 results (max 1 000 per request).\n\n' +
      'Seniority levels: CXO, Vice President, Director, Manager, Senior, Entry, Training, Owner / Partner\n\n' +
      'Tip: always prefer company_linkedin_profile_url over company name to avoid false matches.',
    inputSchema: {
      type: 'object',
      properties: {
        filters: {
          type: 'object',
          description:
            'Filter object. Single: {column, type, value}. Combined: {op:"and"|"or", conditions:[…]}. ' +
            'Key columns: current_employers.title, current_employers.name, ' +
            'current_employers.company_linkedin_profile_url, ' +
            'current_employers.seniority_level, current_employers.function_category, ' +
            'current_employers.company_headcount_latest, current_employers.company_industries, ' +
            'current_employers.company_hq_location, current_employers.years_at_company_raw, ' +
            'past_employers.title, all_employers.name, ' +
            'location_city, location_state, location_country, region, ' +
            'skills, years_of_experience_raw, num_of_connections, recently_changed_jobs, ' +
            'education_background.institute_name, education_background.degree_name. ' +
            'Operators: = != in not_in > < => =< (.) [.] geo_distance.',
        },
        limit: {
          type: 'integer',
          description: 'Results per page (1–1 000, default 20).',
          default: 20,
          minimum: 1,
          maximum: 1000,
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor from previous response.',
        },
        sorts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              order: { type: 'string', enum: ['asc', 'desc'] },
            },
            required: ['column', 'order'],
          },
        },
        preview: {
          type: 'boolean',
          description: 'Basic profile lookup — 0 credits. Returns limited fields.',
          default: false,
        },
        post_processing: {
          type: 'object',
          description: 'Optional exclusion filters applied after results are fetched.',
          properties: {
            exclude_profiles: {
              type: 'array',
              description: 'LinkedIn profile URLs to exclude from results (max 50 000).',
              items: { type: 'string' },
            },
            exclude_names: {
              type: 'array',
              description: 'Names to exclude.',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  },

  // ── 3. Get Company Details (enrichment) ───────────────────────────────────
  {
    name: 'get_company_details',
    description:
      'Enrich detailed company data by domain, name, LinkedIn URL, or Crustdata company ID. ' +
      'Returns firmographics, headcount trends, funding history, web traffic, ' +
      'Glassdoor/G2 ratings, LinkedIn followers, job openings, founders, CXOs, and more. ' +
      '1 credit per company (5 if enrich_realtime=true).',
    inputSchema: {
      type: 'object',
      properties: {
        company_domain: {
          type: 'string',
          description:
            'Comma-separated domains (max 25), e.g. "stripe.com,openai.com".',
        },
        company_name: {
          type: 'string',
          description: 'Comma-separated company names (max 25).',
        },
        company_linkedin_url: {
          type: 'string',
          description:
            'Comma-separated LinkedIn company URLs (max 25), ' +
            'e.g. "https://www.linkedin.com/company/stripe".',
        },
        company_id: {
          type: 'string',
          description: 'Comma-separated Crustdata company IDs (max 25).',
        },
        fields: {
          type: 'string',
          description:
            'Comma-separated extra data sections to include: ' +
            'headcount, competitors, funding_and_investment, g2, gartner, ' +
            'glassdoor, job_openings, linkedin_followers, news_articles, ' +
            'producthunt, seo, taxonomy, web_traffic, founders, cxos, ' +
            'decision_makers, estimated_revenue_timeseries, markets, all_office_addresses.',
        },
        enrich_realtime: {
          type: 'boolean',
          description:
            'Fetch live data from LinkedIn for companies not in the database. ' +
            'Costs 5 credits instead of 1; takes up to 10 minutes.',
          default: false,
        },
        exact_match: {
          type: 'boolean',
          description: 'Exact (case-insensitive) match for company_name/domain lookups.',
          default: false,
        },
      },
    },
  },

  // ── 4. Enrich Person ─────────────────────────────────────────────────────
  {
    name: 'enrich_person',
    description:
      'Enrich one or more person profiles by LinkedIn URL or business email. ' +
      'Returns full profile: employment history, education, skills, ' +
      'emails, social links, and optional extras (GitHub, certifications, etc.). ' +
      '3 credits per profile (5 if enrich_realtime=true). +2 credits for business_email field.',
    inputSchema: {
      type: 'object',
      properties: {
        linkedin_profile_url: {
          type: 'string',
          description:
            'Comma-separated LinkedIn profile URLs (max 25), ' +
            'e.g. "https://www.linkedin.com/in/satyanadella,https://www.linkedin.com/in/sundarpichai".',
        },
        business_email: {
          type: 'string',
          description:
            'Business email for reverse lookup. ' +
            'Mutually exclusive with linkedin_profile_url.',
        },
        fields: {
          type: 'string',
          description:
            'Comma-separated extra fields to return: ' +
            'business_email, github_profiles, certifications, honors, ' +
            'linkedin_open_to_cards, linkedin_verifications, ' +
            'all_employers, past_employers, current_employers, ' +
            'education_background, all_titles, all_schools, all_degrees.',
        },
        enrich_realtime: {
          type: 'boolean',
          description: 'Fetch live from LinkedIn if profile is not in database.',
          default: false,
        },
        preview: {
          type: 'boolean',
          description: 'Return a basic profile preview at 0 credits.',
          default: false,
        },
      },
    },
  },

  // ── 5. Get Job Listings ───────────────────────────────────────────────────
  {
    name: 'get_job_listings',
    description:
      'Search job listings from the Crustdata database. ' +
      'Filter by company, job title, location, and posting date. ' +
      'Use company_id (from identify_company) for fastest results (~1 s vs ~30 s for domain). ' +
      '1 credit per result returned.',
    inputSchema: {
      type: 'object',
      required: ['filters'],
      properties: {
        filters: {
          type: 'object',
          description:
            'Filter object with op ("and"/"or") and conditions array. ' +
            'Key columns: company_id (int, use "in" operator), ' +
            'company_website_domain (use "(.)"), ' +
            'title (use "=", "in", or "(.)"), ' +
            'date_updated (use ">" with ISO date string), ' +
            'date_added (use "=>"), ' +
            'location_text (use "(.)").',
          required: ['op', 'conditions'],
          properties: {
            op: { type: 'string', enum: ['and', 'or'] },
            conditions: { type: 'array' },
          },
        },
        limit: {
          type: 'integer',
          description: 'Max results to return (1–100).',
          default: 100,
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: 'integer',
          description: 'Offset for pagination.',
          default: 0,
          minimum: 0,
        },
        sorts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              order: { type: 'string', enum: ['asc', 'desc'] },
            },
            required: ['column', 'order'],
          },
        },
        sync_from_source: {
          type: 'boolean',
          description:
            'Fetch real-time from source (single company_id only). Costs 5 credits.',
          default: false,
        },
      },
    },
  },

  // ── 6. Identify Company ───────────────────────────────────────────────────
  {
    name: 'identify_company',
    description:
      'Identify a company in the Crustdata database by name, domain, LinkedIn URL, or Crunchbase URL. ' +
      'Returns linkedin_id, linkedin_url, and basic firmographics. ' +
      'FREE — no credits consumed. Use this first to get a company_id for other queries.',
    inputSchema: {
      type: 'object',
      properties: {
        query_company_name: {
          type: 'string',
          description: 'Company name (fuzzy match by default).',
        },
        query_company_website: {
          type: 'string',
          description: 'Company website domain, e.g. "stripe.com".',
        },
        query_company_linkedin_url: {
          type: 'string',
          description:
            'LinkedIn company URL, e.g. "https://www.linkedin.com/company/stripe".',
        },
        query_company_crunchbase_url: {
          type: 'string',
          description: 'Crunchbase URL (vanity or UUID format).',
        },
        query_company_id: {
          type: 'string',
          description: 'Crustdata company ID.',
        },
        exact_match: {
          type: 'boolean',
          description:
            'Use exact case-insensitive match for name (vs fuzzy). ' +
            'Note: stored names come from LinkedIn and may differ from common spellings.',
          default: false,
        },
        count: {
          type: 'integer',
          description: 'Max results to return (1–25, default 10).',
          default: 10,
          minimum: 1,
          maximum: 25,
        },
      },
    },
  },

  // ── 7. Get Company LinkedIn Posts ─────────────────────────────────────────
  {
    name: 'get_company_linkedin_posts',
    description:
      'Fetch recent LinkedIn posts from a company. ' +
      'Returns post content, engagement metrics (reactions, comments, shares), and timestamps. ' +
      'Real-time from LinkedIn — expect 30–60 s latency. ' +
      '1 credit per post; +4 credits to include reactors; +4 credits to include comments.',
    inputSchema: {
      type: 'object',
      properties: {
        company_domain: { type: 'string', description: 'Company domain, e.g. "stripe.com".' },
        company_id: { type: 'string', description: 'Crustdata company ID.' },
        company_linkedin_url: {
          type: 'string',
          description: 'LinkedIn company URL.',
        },
        company_name: { type: 'string', description: 'Company name.' },
        linkedin_post_url: {
          type: 'string',
          description: 'Fetch a single specific post instead of the company feed.',
        },
        fields: {
          type: 'string',
          description:
            'Extra data to include: "reactors", "comments", or "reactors,comments".',
        },
        post_types: {
          type: 'string',
          description: '"original", "repost", or "repost, original" (default).',
          default: 'repost, original',
        },
        limit: {
          type: 'integer',
          description: 'Number of posts to return (1–100).',
          minimum: 1,
          maximum: 100,
        },
        page: {
          type: 'integer',
          description: 'Page number (1–20, default 1).',
          default: 1,
          minimum: 1,
          maximum: 20,
        },
        max_reactors: {
          type: 'integer',
          description: 'Max reactors to return per post (1–5 000, default 100).',
          default: 100,
          minimum: 1,
          maximum: 5000,
        },
        max_comments: {
          type: 'integer',
          description: 'Max comments to return per post (1–5 000, default 100).',
          default: 100,
          minimum: 1,
          maximum: 5000,
        },
      },
    },
  },

  // ── 8. Get Person LinkedIn Posts ──────────────────────────────────────────
  {
    name: 'get_person_linkedin_posts',
    description:
      'Fetch recent LinkedIn posts from a specific person. ' +
      'Returns post content and engagement metrics. ' +
      'Real-time from LinkedIn — expect 30–60 s latency.',
    inputSchema: {
      type: 'object',
      required: ['linkedin_profile_url'],
      properties: {
        linkedin_profile_url: {
          type: 'string',
          description: 'LinkedIn profile URL of the person.',
        },
        limit: {
          type: 'integer',
          description: 'Number of posts to return (1–100).',
          minimum: 1,
          maximum: 100,
        },
        page: {
          type: 'integer',
          description: 'Page number (1–20, default 1).',
          default: 1,
          minimum: 1,
          maximum: 20,
        },
      },
    },
  },

  // ── 9. Search LinkedIn Posts by Keyword ──────────────────────────────────
  {
    name: 'search_linkedin_posts',
    description:
      'Search LinkedIn posts by keyword. ' +
      'Returns posts matching the keyword with engagement metrics and author info.',
    inputSchema: {
      type: 'object',
      required: ['keyword'],
      properties: {
        keyword: {
          type: 'string',
          description: 'Keyword or phrase to search for in LinkedIn posts.',
        },
        limit: {
          type: 'integer',
          description: 'Number of posts to return (1–100).',
          minimum: 1,
          maximum: 100,
        },
        page: {
          type: 'integer',
          description: 'Page number (default 1).',
          default: 1,
          minimum: 1,
        },
      },
    },
  },

  // ── 10. Real-time Company Search (LinkedIn) ──────────────────────────────
  {
    name: 'search_companies_realtime',
    description:
      'Search companies in real-time directly from LinkedIn. ' +
      '25 results per page. 1 credit per company returned.\n\n' +
      'Supported filter types: COMPANY_HEADCOUNT, ANNUAL_REVENUE, REGION, INDUSTRY, ' +
      'JOB_OPPORTUNITIES (value: "Hiring on Linkedin"), ' +
      'ACCOUNT_ACTIVITIES (value: "Funding events in past 12 months").\n\n' +
      'COMPANY_HEADCOUNT values: "1-10", "11-50", "51-200", "201-500", "501-1000", ' +
      '"1,001-5,000", "5,001-10,000", "10,001+".\n\n' +
      'Use search_companies (database) instead for faster, cheaper searches.',
    inputSchema: {
      type: 'object',
      required: ['filters'],
      properties: {
        filters: {
          type: 'array',
          description: 'Array of filter objects.',
          items: {
            type: 'object',
            required: ['filter_type', 'type'],
            properties: {
              filter_type: { type: 'string' },
              type: { type: 'string' },
              value: {},
              sub_filter: { type: 'string', description: 'e.g. "USD" for ANNUAL_REVENUE' },
            },
          },
        },
        page: {
          type: 'integer',
          description: 'Page number (1–65, default 1).',
          default: 1,
          minimum: 1,
          maximum: 65,
        },
      },
    },
  },

  // ── 11. Real-time People Search (LinkedIn) ───────────────────────────────
  {
    name: 'search_people_realtime',
    description:
      'Search people in real-time from LinkedIn. Expect 10–30 s latency. ' +
      '25 results per page. 1 credit per profile (minimum 5 credits).\n\n' +
      'Filter types: CURRENT_COMPANY, PAST_COMPANY, CURRENT_TITLE, PAST_TITLE, ' +
      'FIRST_NAME, LAST_NAME, REGION, INDUSTRY, COMPANY_HEADQUARTERS, ' +
      'FUNCTION (Sales/Engineering/Marketing/…), ' +
      'SENIORITY_LEVEL (Vice President/Director/Manager/…), ' +
      'SCHOOL, KEYWORD, RECENTLY_CHANGED_JOBS (no value).\n\n' +
      'Add fuzzy_match:true to a filter for fuzzy title matching. ' +
      'Use strict_title_and_company_match:true in post_processing for exact matching.',
    inputSchema: {
      type: 'object',
      required: ['filters'],
      properties: {
        filters: {
          type: 'array',
          description: 'Array of filter objects.',
          items: {
            type: 'object',
            required: ['filter_type'],
            properties: {
              filter_type: { type: 'string' },
              type: { type: 'string' },
              value: {},
              fuzzy_match: { type: 'boolean' },
            },
          },
        },
        page: {
          type: 'integer',
          description: 'Page for sync search (mutually exclusive with limit).',
          minimum: 1,
          maximum: 100,
        },
        limit: {
          type: 'integer',
          description: 'Total results for large sync searches (up to 2 000). Mutually exclusive with page.',
          minimum: 1,
        },
        preview: {
          type: 'boolean',
          description: 'Return a basic preview (5 credits).',
          default: false,
        },
        post_processing: {
          type: 'object',
          properties: {
            strict_title_and_company_match: {
              type: 'boolean',
              description: 'Exact title + company match post-processing. Cannot combine with fuzzy_match.',
            },
            exclude_profiles: {
              type: 'array',
              items: { type: 'string' },
            },
            exclude_names: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  },
];

// ─── Route map: tool name → Crustdata API path ────────────────────────────────
// Adjust these paths if Crustdata updates their API routes.

type ToolHandler = (apiKey: string, args: Record<string, unknown>) => Promise<unknown>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  search_companies: (apiKey, args) =>
    callCrustdata(apiKey, '/screener/companydb/search', args),

  search_people: (apiKey, args) =>
    callCrustdata(apiKey, '/screener/persondb/search', args),

  get_company_details: (apiKey, args) =>
    getCrustdata(apiKey, '/screener/company', args as Record<string, unknown>),

  enrich_person: (apiKey, args) =>
    getCrustdata(apiKey, '/screener/person/enrich', args as Record<string, unknown>),

  get_job_listings: (apiKey, args) =>
    callCrustdata(apiKey, '/data_lab/job_listings/Table/', {
      tickers: [],
      dataset: { name: 'job_listings', id: 'joblisting' },
      filters: args.filters,
      offset: args.offset ?? 0,
      limit: args.limit ?? 100,
      sorts: args.sorts ?? [],
      ...(args.sync_from_source !== undefined && { sync_from_source: args.sync_from_source }),
    }),

  identify_company: (apiKey, args) =>
    callCrustdata(apiKey, '/screener/identify/', args),

  get_company_linkedin_posts: (apiKey, args) =>
    getCrustdata(apiKey, '/screener/linkedin_posts', args as Record<string, unknown>),

  get_person_linkedin_posts: (apiKey, args) => {
    const params = { ...args } as Record<string, unknown>;
    if (params.linkedin_profile_url) {
      params.person_linkedin_url = params.linkedin_profile_url;
      delete params.linkedin_profile_url;
    }
    return getCrustdata(apiKey, '/screener/linkedin_posts', params);
  },

  search_linkedin_posts: (apiKey, args) =>
    callCrustdata(apiKey, '/screener/linkedin_posts/keyword_search/', args),

  search_companies_realtime: (apiKey, args) =>
    callCrustdata(apiKey, '/screener/company/search', args),

  search_people_realtime: (apiKey, args) =>
    callCrustdata(apiKey, '/screener/person/search', args),
};

// ─── MCP Server factory ───────────────────────────────────────────────────────

/**
 * Creates a fully configured MCP Server for a specific customer.
 * The `apiKey` is captured in the closure and injected into every
 * Crustdata API call — it is never sent to the MCP client.
 */
export function createMCPServer(apiKey: string): Server {
  const server = new Server(
    { name: 'crustdata-mcp-proxy', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  // Execute a tool call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const handler = TOOL_HANDLERS[name];

    if (!handler) {
      return {
        content: [{ type: 'text', text: `Unknown tool: "${name}". Available tools: ${Object.keys(TOOL_HANDLERS).join(', ')}` }],
        isError: true,
      };
    }

    try {
      const result = await handler(apiKey, args as Record<string, unknown>);
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[tool:${name}] Error: ${message}`);
      return {
        content: [{ type: 'text', text: `Tool error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}
