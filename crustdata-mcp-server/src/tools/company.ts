import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CrustdataClient } from "../client.js";

export function registerCompanyTools(server: McpServer, client: CrustdataClient) {

  // 1. Identify Company (FREE)
  server.tool(
    "crustdata_identify_company",
    "Identify a company in Crustdata's database using name, website, LinkedIn URL, Crunchbase URL, or company ID. Returns linkedin_id, linkedin_url, and basic firmographics. FREE - no credits consumed. Use this first to get company IDs before enrichment.",
    {
      query_company_name: z.string().optional().describe("Company name (fuzzy match by default)"),
      query_company_website: z.string().optional().describe("Company website domain, e.g. 'stripe.com'"),
      query_company_linkedin_url: z.string().optional().describe("LinkedIn company URL, e.g. 'https://www.linkedin.com/company/stripe'"),
      query_company_crunchbase_url: z.string().optional().describe("Crunchbase URL (vanity or UUID format)"),
      query_company_id: z.string().optional().describe("Crustdata company ID"),
      exact_match: z.boolean().default(false).describe("Use exact case-insensitive match for name (vs fuzzy)"),
      count: z.number().min(1).max(25).default(10).describe("Max results to return"),
    },
    async (args) => {
      const params: Record<string, string> = {};
      if (args.query_company_name) params.query_company_name = args.query_company_name;
      if (args.query_company_website) params.query_company_website = args.query_company_website;
      if (args.query_company_linkedin_url) params.query_company_linkedin_url = args.query_company_linkedin_url;
      if (args.query_company_crunchbase_url) params.query_company_crunchbase_url = args.query_company_crunchbase_url;
      if (args.query_company_id) params.query_company_id = args.query_company_id;
      if (args.exact_match) params.exact_match = "true";
      params.count = String(args.count);

      const result = await client.get("/screener/identify", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 2. Enrich Company (1 credit/company, 5 if realtime)
  server.tool(
    "crustdata_enrich_company",
    "Enrich detailed company data by domain, name, LinkedIn URL, or company ID. Returns firmographics, headcount trends, funding, web traffic, Glassdoor ratings, G2 reviews, LinkedIn followers, job openings, founders, CXOs, and more. 1 credit/company (5 if enrich_realtime=true).",
    {
      company_domain: z.string().optional().describe("Comma-separated domains, e.g. 'stripe.com,openai.com' (max 25)"),
      company_name: z.string().optional().describe("Comma-separated company names (max 25)"),
      company_linkedin_url: z.string().optional().describe("Comma-separated LinkedIn URLs (max 25)"),
      company_id: z.string().optional().describe("Comma-separated Crustdata company IDs (max 25)"),
      fields: z.string().optional().describe("Comma-separated fields: headcount, competitors, funding_and_investment, g2, gartner, glassdoor, job_openings, linkedin_followers, news_articles, producthunt, seo, taxonomy, web_traffic, founders, cxos, decision_makers, estimated_revenue_timeseries, markets, all_office_addresses"),
      enrich_realtime: z.boolean().default(false).describe("Enrich in real-time for companies not in DB. Costs 5 credits vs 1."),
      exact_match: z.boolean().default(false).describe("Exact match for company_name/domain lookup"),
    },
    async (args) => {
      const params: Record<string, string> = {};
      if (args.company_domain) params.company_domain = args.company_domain;
      if (args.company_name) params.company_name = args.company_name;
      if (args.company_linkedin_url) params.company_linkedin_url = args.company_linkedin_url;
      if (args.company_id) params.company_id = args.company_id;
      if (args.fields) params.fields = args.fields;
      if (args.enrich_realtime) params.enrich_realtime = "true";
      if (args.exact_match) params.exact_match = "true";

      const result = await client.get("/screener/company/enrich", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 3. Search Companies (CompanyDB - in-database search)
  server.tool(
    "crustdata_search_companies",
    "Search companies in Crustdata's CompanyDB with rich filters. Supports cursor pagination. Filter by headcount, funding, revenue, industry, location, growth metrics, and more. Use (.) for fuzzy match, [.] for exact token match. ISO 3-alpha country codes for hq_country.",
    {
      filters: z.any().describe("Filter object with {op:'and'|'or', conditions:[{column, type, value},...]}. Operators: = != > < => =< in not_in (.) [.]"),
      cursor: z.string().optional().describe("Cursor from previous response for pagination"),
      count: z.number().min(1).max(100).default(20).describe("Results per page"),
      sorts: z.array(z.object({ column: z.string(), order: z.enum(["asc", "desc"]) })).optional().describe("Sort criteria"),
    },
    async (args) => {
      const body: any = { filters: args.filters, count: args.count };
      if (args.cursor) body.cursor = args.cursor;
      if (args.sorts) body.sorts = args.sorts;

      const result = await client.post("/screener/companydb/search/", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 4. Search Companies Realtime (from LinkedIn)
  server.tool(
    "crustdata_search_companies_realtime",
    "Search companies in real-time from LinkedIn using filters like headcount range, industry, region, revenue, job opportunities, and account activities. Returns 25 results per page. 1 credit per company returned.\n\nFilter types: COMPANY_HEADCOUNT (values: '1-10','11-50','51-200','201-500','501-1000','1,001-5,000','5,001-10,000','10,001+'), ANNUAL_REVENUE (with sub_filter: 'USD'), REGION, INDUSTRY, JOB_OPPORTUNITIES (value: 'Hiring on Linkedin'), ACCOUNT_ACTIVITIES (value: 'Funding events in past 12 months')\n\nUse crustdata_autocomplete_filter to get valid region/industry values.",
    {
      filters: z.array(z.object({
        filter_type: z.string(),
        type: z.string(),
        value: z.any().optional(),
        sub_filter: z.string().optional(),
      })).describe("Array of filter objects"),
      page: z.number().min(1).max(65).default(1).describe("Page number"),
    },
    async (args) => {
      const body: any = { filters: args.filters, page: args.page };
      const result = await client.post("/screener/company/search", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 5. Autocomplete Company Field (FREE)
  server.tool(
    "crustdata_autocomplete_company_field",
    "Get valid filter values for CompanyDB search fields. Use this to find exact values for industries, countries, company types, etc. before building filters. FREE - no credits.",
    {
      field: z.string().describe("Field name: 'linkedin_industries', 'hq_country', 'crunchbase_categories', 'markets', 'company_type', 'last_funding_round_type'"),
      query: z.string().describe("Partial text to search for, e.g. 'software' for linkedin_industries"),
      limit: z.number().min(1).max(50).default(10).describe("Max results"),
    },
    async (args) => {
      const params: Record<string, string> = {
        field: args.field,
        query: args.query,
        limit: String(args.limit),
      };
      const result = await client.get("/screener/companydb/autocomplete", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 6. Autocomplete Filter (LinkedIn filter values, FREE)
  server.tool(
    "crustdata_autocomplete_filter",
    "Get autocomplete suggestions for LinkedIn filter values (region, industry, title, school). Use before building realtime company/people search filters. FREE - no credits.",
    {
      filter_type: z.enum(["region", "industry", "title", "school"]).describe("Type of filter"),
      query: z.string().describe("Partial text to search, e.g. 'san' for San Francisco"),
      count: z.number().min(1).max(50).default(10).describe("Max results"),
      start: z.number().min(0).default(0).describe("Pagination offset"),
    },
    async (args) => {
      const body = {
        filter_type: args.filter_type,
        query: args.query,
        count: args.count,
        start: args.start,
      };
      const result = await client.post("/screener/autocomplete", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
