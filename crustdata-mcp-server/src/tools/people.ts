import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CrustdataClient } from "../client.js";

export function registerPeopleTools(server: McpServer, client: CrustdataClient) {

  // 7. Enrich Person (3 credits/profile, 5 if realtime)
  server.tool(
    "crustdata_enrich_person",
    "Enrich person profile(s) by LinkedIn URL or business email. Returns full profile: employment history, education, skills, emails, social links, and more. 3 credits/profile (5 if realtime). +2 credits for business_email field.\n\nUp to 25 profiles per request. Use enrich_realtime=true for profiles not in DB.\n\nSpecial fields: business_email, github_profiles, certifications, honors, linkedin_open_to_cards\n\nReverse email lookup: provide business_email param instead of linkedin_profile_url.",
    {
      linkedin_profile_url: z.string().optional().describe("Comma-separated LinkedIn profile URLs (max 25)"),
      business_email: z.string().optional().describe("Business email for reverse lookup (mutually exclusive with linkedin_profile_url)"),
      fields: z.string().optional().describe("Comma-separated fields: business_email, github_profiles, certifications, honors, linkedin_open_to_cards, linkedin_verifications, education_background.activities_and_societies, all_employers, past_employers, current_employers, education_background, all_titles, all_schools, all_degrees"),
      enrich_realtime: z.boolean().default(false).describe("Fetch live from LinkedIn if not in DB (5 credits vs 3)"),
      preview: z.boolean().default(false).describe("Basic profile preview, 0 credits"),
    },
    async (args) => {
      const params: Record<string, string> = {};
      if (args.linkedin_profile_url) params.linkedin_profile_url = args.linkedin_profile_url;
      if (args.business_email) params.business_email = args.business_email;
      if (args.fields) params.fields = args.fields;
      if (args.enrich_realtime) params.enrich_realtime = "true";
      if (args.preview) params.preview = "true";

      const result = await client.get("/screener/person/enrich", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 8. Search People (In-DB, 3 credits per 100 results)
  server.tool(
    "crustdata_search_people",
    "Search people in Crustdata's database using rich filters. 3 credits per 100 results. Max 1000/request. Supports cursor pagination.\n\nKey filter fields (use dot notation):\n- current_employers.title, current_employers.name, current_employers.company_linkedin_profile_url, current_employers.linkedin_id, current_employers.company_website_domain, current_employers.seniority_level, current_employers.function_category, current_employers.company_headcount_latest, current_employers.company_industries, current_employers.company_hq_location, current_employers.start_date, current_employers.years_at_company_raw, current_employers.business_email_verified\n- past_employers.*, all_employers.*\n- region, headline, skills, years_of_experience_raw, num_of_connections, recently_changed_jobs\n- education_background.institute_name, education_background.degree_name, education_background.field_of_study\n- certifications.name, honors.title, languages\n- location_city, location_state, location_country\n\nSeniority levels: 'CXO', 'Vice President', 'Director', 'Manager', 'Senior', 'Entry', 'Training', 'Owner / Partner'\n\nFor company matching: ALWAYS prefer company_linkedin_profile_url over company name.\n\nUse geo_distance for radius search: {column:'region', type:'geo_distance', value:{location:'San Francisco', distance:25, unit:'mi'}}",
    {
      filters: z.any().describe("Filter object. Single: {column, type, value}. Combined: {op:'and'|'or', conditions:[...]}. Operators: = != in not_in > < => =< (.) [.] geo_distance"),
      limit: z.number().min(1).max(1000).default(20).describe("Max results"),
      cursor: z.string().optional().describe("Cursor from previous response for pagination"),
      preview: z.boolean().default(false).describe("Basic profile lookup, 0 credits"),
      sorts: z.array(z.object({
        column: z.string().describe("Sortable: person_id, years_of_experience_raw, num_of_connections, name, recently_changed_jobs, current_employers.years_at_company_raw, current_employers.start_date, current_employers.company_headcount_latest, region, location_city, location_state, location_country"),
        order: z.enum(["asc", "desc"]),
      })).optional(),
      post_processing: z.object({
        exclude_names: z.array(z.string()).optional().describe("Names to exclude"),
        exclude_profiles: z.array(z.string()).optional().describe("LinkedIn profile URLs to exclude (max 50,000)"),
      }).optional(),
    },
    async (args) => {
      const body: any = { filters: args.filters, limit: args.limit };
      if (args.cursor) body.cursor = args.cursor;
      if (args.preview) body.preview = args.preview;
      if (args.sorts) body.sorts = args.sorts;
      if (args.post_processing) body.post_processing = args.post_processing;

      const result = await client.post("/screener/people/search", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 9. Search People Realtime (background jobs)
  server.tool(
    "crustdata_search_people_realtime",
    "Search people in real-time from LinkedIn. Returns background task - poll with get_task_result. Supports fuzzy_match per filter, strict_title_and_company_match. Use crustdata_autocomplete_filter for valid region/industry/title/school values.",
    {
      filters: z.array(z.object({
        filter_type: z.string().describe("CURRENT_COMPANY, PAST_COMPANY, CURRENT_TITLE, PAST_TITLE, REGION, INDUSTRY, SCHOOL, FIRST_NAME, LAST_NAME, PROFILE_LANGUAGE, YEARS_OF_EXPERIENCE"),
        type: z.string().describe("'in' or 'not_in'"),
        value: z.any(),
        fuzzy_match: z.boolean().optional().describe("Allow fuzzy matching for this filter"),
      })).describe("Array of filter objects"),
      page: z.number().min(1).default(1).describe("Page number"),
      strict_title_and_company_match: z.boolean().default(false).describe("Strict matching for title and company"),
    },
    async (args) => {
      const body: any = {
        filters: args.filters,
        page: args.page,
      };
      if (args.strict_title_and_company_match) {
        body.strict_title_and_company_match = true;
      }

      const result = await client.post("/screener/person/search", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // 10. Autocomplete Person Field (FREE)
  server.tool(
    "crustdata_autocomplete_person_field",
    "Get valid filter values for PersonDB search fields. Use before filtering to get exact values. FREE - no credits. Fields: region, current_employers.name, current_employers.title, education_background.institute_name, current_employers.function_category, current_employers.seniority_level",
    {
      field: z.string().describe("Field name, e.g. 'region', 'current_employers.name', 'current_employers.title'"),
      query: z.string().describe("Partial text to match, e.g. 'san franci'"),
      limit: z.number().min(1).max(50).default(10).describe("Max results"),
    },
    async (args) => {
      const params: Record<string, string> = {
        field: args.field,
        query: args.query,
        limit: String(args.limit),
      };
      const result = await client.get("/screener/people/autocomplete", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
