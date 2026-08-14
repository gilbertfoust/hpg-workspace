import { QueryClient } from "@tanstack/react-query";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";

const isNonRetryableQueryError = (error: unknown) => {
  if (isSupabaseNotConfiguredError(error)) return true;

  const value = error as {
    message?: unknown;
    status?: unknown;
    statusCode?: unknown;
  } | null;
  const status = Number(value?.status ?? value?.statusCode);

  if (Number.isFinite(status) && status >= 400 && status < 500 && status !== 408 && status !== 409) {
    return true;
  }

  const message = String(value?.message ?? error ?? "").toLowerCase();
  return [
    "permission denied",
    "row-level security",
    "does not exist",
    "not configured",
    "invalid jwt",
    "jwt expired",
  ].some((fragment) => message.includes(fragment));
};

/**
 * Use one bounded application-level retry for transient reads. This avoids a
 * dashboard request storm while still recovering from a brief network fault.
 */
export const createWorkspaceQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => failureCount < 1 && !isNonRetryableQueryError(error),
      retryDelay: 750,
    },
    mutations: {
      retry: false,
    },
  },
});
