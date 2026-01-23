import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Read env vars that should be injected at build time (Vite)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

/**
 * Custom error used when Supabase is not configured.
 * Other parts of the app already import and check this.
 */
export class SupabaseNotConfiguredError extends Error {
  constructor(
    message = "Supabase not configured: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY"
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

/**
 * Create the Supabase client if env vars are present.
 * If they are missing (e.g., in some preview environments),
 * export `supabase` as `null` so the app can still render and
 * show a friendly “not configured” message instead of crashing.
 */
function createSupabaseClient(): SupabaseClient<Database> | null {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return null;
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
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
  if (!supabase || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new SupabaseNotConfiguredError();
  }
  return supabase;
};
