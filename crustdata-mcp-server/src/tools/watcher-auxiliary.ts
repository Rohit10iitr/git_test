import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CrustdataClient } from "../client.js";

export function registerWatcherAuxiliaryTools(server: McpServer, client: CrustdataClient) {

  // 11. Get Company LinkedIn Posts (1 credit/post)
  server.tool(
    "crustdata_get_company_linkedin_posts",
    "Fetch recent LinkedIn posts for a company (real-time). Includes post text, reactions, comments, shares, and reactor profiles. 30-60s latency. 1 credit/post (5 with reactors, 5 with comments, 10 with both).",
    {
      company_linkedin_url: z.string().optional().describe("Company LinkedIn URL"),
      company_domain: z.string().optional().describe("Company domain, e.g. 'crustdata.com'"),
      company_name: z.string().optional().describe("Company name"),
      company_id: z.string().optional().describe("Crustdata company ID"),
      linkedin_post_url: z.string().optional().describe("Fetch a single specific post URL"),
      fields: z.string().optional().describe("Extra fields: 'reactors', 'comments', or 'reactors,comments'"),
      limit: z.number().min(1).max(100).optional().describe("Number of posts to return"),
      page: z.number().min(1).max(20).default(1).describe("Page number"),
      post_types: z.string().default("repost, original").describe("'original', 'repost', or 'repost, original'"),
      max_reactors: z.number().min(1).max(5000).default(100),
      max_comments: z.number().min(1).max(5000).default(100),
    },
    async (args) => {
      const body: any = { page: args.page, post_types: args.post_types };
      if (args.company_linkedin_url) body.company_linkedin_url = args.company_linkedin_url;
      if (args.company_domain) body.company_domain = args.company_domain;
      if (args.company_name) body.company_name = args.company_name;
      if (args.company_id) body.company_id = args.company_id;
      if (args.linkedin_post_url) body.linkedin_post_url = args.linkedin_post_url;
      if (args.fields) body.fields = args.fields;
      if (args.limit) body.limit = args.limit;
      body.max_reactors = args.max_reactors;
      body.max_comments = args.max_comments;

      const result = await client.post("/screener/linkedin/posts/company", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 12. Get Person LinkedIn Posts (1 credit/post)
  server.tool(
    "crustdata_get_person_linkedin_posts",
    "Fetch recent LinkedIn posts by a specific person (real-time, 30-60s latency). Includes post text, engagement metrics, reactors, and comments. 1 credit/post (5 with reactors, 5 with comments, 10 with both).",
    {
      person_linkedin_url: z.string().optional().describe("LinkedIn profile URL of the person"),
      linkedin_post_url: z.string().optional().describe("Fetch a single specific post (cannot use with person_linkedin_url)"),
      fields: z.string().optional().describe("'reactors', 'comments', or 'reactors,comments'"),
      limit: z.number().min(1).max(100).optional(),
      page: z.number().min(1).max(20).default(1),
      post_types: z.string().default("repost, original"),
      max_reactors: z.number().min(1).max(5000).default(100),
      max_comments: z.number().min(1).max(5000).default(100),
    },
    async (args) => {
      const body: any = { page: args.page, post_types: args.post_types };
      if (args.person_linkedin_url) body.person_linkedin_url = args.person_linkedin_url;
      if (args.linkedin_post_url) body.linkedin_post_url = args.linkedin_post_url;
      if (args.fields) body.fields = args.fields;
      if (args.limit) body.limit = args.limit;
      body.max_reactors = args.max_reactors;
      body.max_comments = args.max_comments;

      const result = await client.post("/screener/linkedin/posts/person", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 13. Search LinkedIn Posts by Keyword (1 credit/post)
  server.tool(
    "crustdata_search_linkedin_posts_by_keyword",
    "Search LinkedIn posts by keyword (real-time). Supports Boolean operators (OR, AND), date filters, content type filters, and author filters. 1 credit/post.\n\nBoolean example: 'fundraise OR raised OR seed'\nDate options: past-24h, past-week, past-month, past-quarter, past-year\nContent types: photos, videos, documents, jobs, collaborativeArticles, liveVideos\nFilter types: AUTHOR_INDUSTRY, AUTHOR_TITLE, MENTIONING_COMPANY (LinkedIn URL), MEMBER (LinkedIn profile URL)",
    {
      keyword: z.string().describe("Search keyword. Supports Boolean: 'AI OR machine learning'. Max 6 terms."),
      date_posted: z.enum(["past-24h", "past-week", "past-month", "past-quarter", "past-year"]).default("past-month"),
      exact_keyword_match: z.boolean().default(false).describe("Only return posts containing exact keyword phrase"),
      sort_by: z.enum(["relevance", "date_posted"]).default("relevance"),
      fields: z.string().optional().describe("'reactors', 'comments', or 'reactors,comments'"),
      content_type: z.array(z.enum(["photos", "videos", "documents", "jobs", "collaborativeArticles", "liveVideos"])).optional(),
      filters: z.array(z.object({
        filter_type: z.string().describe("AUTHOR_INDUSTRY, AUTHOR_TITLE, MENTIONING_COMPANY, MEMBER"),
        type: z.string().describe("'in' or 'not_in'"),
        value: z.array(z.string()),
      })).optional(),
      page: z.number().min(1).max(100).optional().describe("Page number (5 posts/page)"),
      limit: z.number().min(1).max(500).optional().describe("Total posts to return (use without page for bulk)"),
      max_reactors: z.number().min(0).max(5000).default(5),
      max_comments: z.number().min(0).max(5000).default(5),
    },
    async (args) => {
      const body: any = {
        keyword: args.keyword,
        date_posted: args.date_posted,
        exact_keyword_match: args.exact_keyword_match,
        sort_by: args.sort_by,
        max_reactors: args.max_reactors,
        max_comments: args.max_comments,
      };
      if (args.fields) body.fields = args.fields;
      if (args.content_type) body.content_type = args.content_type;
      if (args.filters) body.filters = args.filters;
      if (args.page) body.page = args.page;
      if (args.limit) body.limit = args.limit;

      const result = await client.post("/screener/linkedin/posts/keyword", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 14. Get Job Listings (1 credit/result)
  server.tool(
    "crustdata_get_job_listings",
    "Search job listings from Crustdata's database. Filter by company, title, location, date. Use company_id for fastest results (~1s vs ~30s for domain). 1 credit per result. Set background_task=true for >100 results.\n\nTip: Use crustdata_identify_company first to get company_id for fast queries.",
    {
      filters: z.object({
        op: z.enum(["and", "or"]),
        conditions: z.array(z.any()).describe("Array of {column, type, value} conditions. Key columns: company_id (int, use 'in'), company_website_domain (use '(.)'), title (use '=', 'in', or '(.)'), date_updated (use '>' with ISO date), location_text (use '(.)')"),
      }),
      limit: z.number().min(1).max(100).default(100),
      offset: z.number().min(0).default(0),
      sorts: z.array(z.object({ column: z.string(), order: z.enum(["asc", "desc"]) })).optional(),
      background_task: z.boolean().default(false).describe("Process async for large result sets. Returns task_id."),
      sync_from_source: z.boolean().default(false).describe("Fetch real-time from source (single company_id only, costs 5 credits)"),
    },
    async (args) => {
      const body: any = {
        filters: args.filters,
        limit: args.limit,
        offset: args.offset,
      };
      if (args.sorts) body.sorts = args.sorts;
      if (args.background_task) body.background_task = true;
      if (args.sync_from_source) body.sync_from_source = true;

      const result = await client.post("/screener/job_listings/search", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 15. Create Watch (webhook)
  server.tool(
    "crustdata_create_watch",
    "Create a real-time watch/webhook to get notified when specific events occur. Notifications sent to your endpoint within ~1 hour.\n\nEvent slugs:\n- company-watch-linkedin-job-postings\n- company-watch-linkedin-posts\n- company-watch-press-mentions\n- company-watch-funding-milestones\n- company-watch-headcount-growth\n- linkedin-person-profile-updates\n- linkedin-person-post-updates",
    {
      event_type_slug: z.string().describe("Event slug from the list above"),
      event_filters: z.array(z.object({
        filter_type: z.string(),
        type: z.string().optional(),
        value: z.any().optional(),
      })).describe("Event-specific filters"),
      notification_endpoint: z.string().describe("HTTPS URL to receive webhook POST notifications"),
      frequency: z.number().default(1).describe("Check frequency in hours"),
      expiration_date: z.string().optional().describe("ISO date when watch expires, e.g. '2026-12-31'"),
      approximate_notification_time: z.number().optional().describe("Hour of day (UTC) to send notifications"),
      max_notifications_per_execution: z.number().optional().describe("Max notifications per run (multiple of 50)"),
    },
    async (args) => {
      const body: any = {
        event_type_slug: args.event_type_slug,
        event_filters: args.event_filters,
        notification_endpoint: args.notification_endpoint,
        frequency: args.frequency,
      };
      if (args.expiration_date) body.expiration_date = args.expiration_date;
      if (args.approximate_notification_time !== undefined) body.approximate_notification_time = args.approximate_notification_time;
      if (args.max_notifications_per_execution !== undefined) body.max_notifications_per_execution = args.max_notifications_per_execution;

      const result = await client.post("/screener/watch/create", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 16. Simulate Watch (test webhook)
  server.tool(
    "crustdata_simulate_watch",
    "Test a watch by sending an immediate example notification to your endpoint. Use this for integration testing before creating real watches.",
    {
      event_type_slug: z.string(),
      event_filters: z.array(z.object({
        filter_type: z.string(),
        type: z.string().optional(),
        value: z.any().optional(),
      })),
      notification_endpoint: z.string(),
      frequency: z.number().default(1),
      expiration_date: z.string().optional(),
      max_notifications_per_execution: z.number().optional(),
    },
    async (args) => {
      const body: any = {
        event_type_slug: args.event_type_slug,
        event_filters: args.event_filters,
        notification_endpoint: args.notification_endpoint,
        frequency: args.frequency,
      };
      if (args.expiration_date) body.expiration_date = args.expiration_date;
      if (args.max_notifications_per_execution !== undefined) body.max_notifications_per_execution = args.max_notifications_per_execution;

      const result = await client.post("/screener/watch/simulate", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 17. Get Task Result (for background jobs)
  server.tool(
    "crustdata_get_task_result",
    "Retrieve the result of a background task (from job listings or people search background jobs). Poll every 10-30 seconds until status is 'completed'.",
    {
      task_id: z.string().describe("Task ID returned from a background job request"),
    },
    async (args) => {
      const result = await client.get("/screener/task/result", { task_id: args.task_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 18. Check Credits (FREE)
  server.tool(
    "crustdata_check_credits",
    "Check your remaining Crustdata API credit balance. FREE - no credits consumed.",
    {},
    async () => {
      const result = await client.get("/screener/credits");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 19. Web Search (1 credit/query)
  server.tool(
    "crustdata_web_search",
    "Search the web using Crustdata's web search API. 1 credit per query. Sources: web, news, scholar-articles, scholar-articles-enriched, scholar-author, ai, social.\n\nTips:\n- Find company domain: query='COMPANY_NAME website', sources=['web']\n- Find LinkedIn URL: site='linkedin.com/company', query='COMPANY_NAME'\n- Find GitHub: site='site:github.com', query='PERSON_NAME'\n- Set fetch_content=true to also get full HTML of result pages",
    {
      query: z.string().max(1000).describe("Search query text"),
      sources: z.array(z.enum(["news", "web", "scholar-articles", "scholar-articles-enriched", "scholar-author", "ai", "social"])).optional(),
      site: z.string().optional().describe("Restrict to domain, e.g. 'linkedin.com/company'"),
      geolocation: z.string().optional().describe("ISO 3166-1 alpha-2 country code, e.g. 'US', 'GB'"),
      startDate: z.number().optional().describe("Unix timestamp for start date filter"),
      endDate: z.number().optional().describe("Unix timestamp for end date filter"),
      fetch_content: z.boolean().default(false).describe("Also fetch full HTML content of result pages"),
    },
    async (args) => {
      const body: any = { query: args.query };
      if (args.sources) body.sources = args.sources;
      if (args.site) body.site = args.site;
      if (args.geolocation) body.geolocation = args.geolocation;
      if (args.startDate) body.startDate = args.startDate;
      if (args.endDate) body.endDate = args.endDate;

      const queryParams: Record<string, string> = {};
      if (args.fetch_content) queryParams.fetch_content = "true";

      const result = await client.post("/screener/web/search", body, queryParams);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 20. Web Fetch (fetch URL content)
  server.tool(
    "crustdata_web_fetch",
    "Fetch and extract content from one or more URLs. Returns cleaned text content from web pages.",
    {
      urls: z.array(z.string()).describe("Array of URLs to fetch content from"),
    },
    async (args) => {
      const body = { urls: args.urls };
      const result = await client.post("/screener/web/fetch", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
