export interface HpgAssistantEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export function loadEnv(): HpgAssistantEnv {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. MCP server must run server-side only.");
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}
