import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Read env vars that should be injected at build time (Vite/Lovable).
// The client accepts both current Supabase naming and older anon-key naming.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PROJECT_URL as string | undefined);

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLIC_ANON_KEY as string | undefined);

const getMissingSupabaseEnvVars = () => {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
  return missing;
};

/**
 * Custom error used when Supabase is not configured.
 * Other parts of the app already import and check this.
 */
export class SupabaseNotConfiguredError extends Error {
  constructor(
    message = `Supabase not configured: missing ${getMissingSupabaseEnvVars().join(" and ") || "required Supabase environment variables"}`
  ) {
    super(message);
    this.name = "SupabaseNotConfiguredError";
  }
}

/**
 * Back-compat export for older modules that expect this helper.
 */
export const getSupabaseNotConfiguredError = () => new SupabaseNotConfiguredError();

/**
 * Type guard so components/hooks can check for this specific error.
 */
export const isSupabaseNotConfiguredError = (
  error: unknown
): error is SupabaseNotConfiguredError => {
  return error instanceof SupabaseNotConfiguredError;
};

export const getSupabaseConfigStatus = () => ({
  isConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  hasUrl: Boolean(SUPABASE_URL),
  hasKey: Boolean(SUPABASE_ANON_KEY),
  projectRef: SUPABASE_URL?.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] ?? null,
  origin: typeof window !== "undefined" ? window.location.origin : null,
  missing: getMissingSupabaseEnvVars(),
});

/**
 * Create the Supabase client if env vars are present.
 * If they are missing (e.g., in some preview environments),
 * export `supabase` as `null` so the app can still render and
 * show a friendly “not configured” message instead of crashing.
 */
function createSupabaseClient(): SupabaseClient<Database> | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `hpg-workspace-${SUPABASE_URL.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] ?? "supabase"}-auth`,
    },
  });
}

/**
 * Main client export. May be `null` if env vars are missing.
 * Code that uses this directly should be defensive or use `ensureSupabase`.
 */
export const supabase = createSupabaseClient();

/**
 * Helper that guarantees a real client or throws a clear error.
 * Hooks that *must* talk to Supabase should call this instead of
 * using `supabase` directly.
 */
export const ensureSupabase = (): SupabaseClient<Database> => {
  if (!supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new SupabaseNotConfiguredError();
  }
  return supabase;
};
