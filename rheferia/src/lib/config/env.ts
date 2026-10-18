/**
 * Server-side environment configuration. Server-only: never import from a
 * client component. Validated lazily so an unconfigured build can render
 * public pages without crashing during prerender.
 */

import "server-only";

export interface SearchProviderConfig {
  openalexApiKey?: string;
  crossrefContactEmail?: string;
  unpaywallEmail?: string;
  semanticScholarApiKey?: string;
  braveApiKey?: string;
  maxRequestsPerSearch: number;
}

export interface AppEnvConfig {
  appMode: "live" | "demo";
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  tempFileRetentionHours: number;
  maxCloudUploadMiB: number;
  maxDailyCloudConversions: number;
  maxConcurrentCloudConversions: number;
  rateLimitSecret: string;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function searchProviderConfig(): SearchProviderConfig {
  return {
    openalexApiKey: optional("OPENALEX_API_KEY"),
    crossrefContactEmail: optional("CROSSREF_CONTACT_EMAIL"),
    unpaywallEmail: optional("UNPAYWALL_EMAIL"),
    semanticScholarApiKey: optional("SEMANTIC_SCHOLAR_API_KEY"),
    braveApiKey: optional("BRAVE_SEARCH_API_KEY"),
    maxRequestsPerSearch: Number(
      process.env.MAX_PROVIDER_REQUESTS_PER_SEARCH ?? 6,
    ),
  };
}

export function appEnvConfig(): AppEnvConfig {
  return {
    appMode: process.env.APP_MODE === "demo" ? "demo" : "live",
    supabaseUrl: optional("NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: optional("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    tempFileRetentionHours: Number(process.env.TEMP_FILE_RETENTION_HOURS ?? 24),
    maxCloudUploadMiB: Number(process.env.MAX_CLOUD_UPLOAD_MIB ?? 25),
    maxDailyCloudConversions: Number(process.env.MAX_DAILY_CLOUD_CONVERSIONS ?? 5),
    maxConcurrentCloudConversions: Number(
      process.env.MAX_CONCURRENT_CLOUD_CONVERSIONS ?? 2,
    ),
    rateLimitSecret: process.env.RATE_LIMIT_SECRET ?? "dev-only-insecure",
  };
}

/** True when Supabase is configured enough for auth/database features. */
export function isSupabaseConfigured(): boolean {
  return Boolean(optional("NEXT_PUBLIC_SUPABASE_URL") && optional("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
}

/** Presence checks only — never print secret values. */
export function preflightReport(): Array<{ key: string; present: boolean; note?: string }> {
  return [
    { key: "NEXT_PUBLIC_SUPABASE_URL", present: Boolean(optional("NEXT_PUBLIC_SUPABASE_URL")), note: "Enables accounts, projects, and saved research" },
    { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", present: Boolean(optional("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) },
    { key: "CROSSREF_CONTACT_EMAIL", present: Boolean(optional("CROSSREF_CONTACT_EMAIL")), note: "Polite-pool access for Crossref" },
    { key: "UNPAYWALL_EMAIL", present: Boolean(optional("UNPAYWALL_EMAIL")), note: "Open-access resolution" },
    { key: "SEMANTIC_SCHOLAR_API_KEY", present: Boolean(optional("SEMANTIC_SCHOLAR_API_KEY")), note: "Optional extra source" },
    { key: "BRAVE_SEARCH_API_KEY", present: Boolean(optional("BRAVE_SEARCH_API_KEY")), note: "Web results (reports, theses, PDFs)" },
    { key: "CLOUDCONVERT_API_KEY", present: Boolean(optional("CLOUDCONVERT_API_KEY")), note: "PDF ↔ Word cloud conversions" },
  ];
}
