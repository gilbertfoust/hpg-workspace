import { ensureSupabase } from "@/integrations/supabase/client";
import type { FunctionsHttpError } from "@supabase/supabase-js";

async function getInvokeErrorMessage(error: FunctionsHttpError): Promise<string> {
  try {
    const context = error.context;
    if (context && typeof context.json === "function") {
      const payload = await context.json();
      if (payload && typeof payload === "object" && "error" in payload && payload.error) {
        return String(payload.error);
      }
    }
  } catch {
    // Fall back to the generic error message below.
  }
  return error.message || "Admin request failed";
}

export async function invokeAdminFunction<T = Record<string, unknown>>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const client = ensureSupabase();
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error("You must be logged in to perform this action.");
  }

  const { data, error } = await client.functions.invoke(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(await getInvokeErrorMessage(error as FunctionsHttpError));
  }

  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }

  return data as T;
}

export const isNgoPortalRole = (role: string) => role === "external_ngo" || role === "ngo_user";
