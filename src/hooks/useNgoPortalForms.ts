import { useQuery } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import type { FormTemplate } from "@/hooks/useFormTemplates";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

/**
 * NGO portal templates are read-only definitions. Draft and submit operations
 * are deliberately handled by the shared canonical form workflow.
 */
export const useNgoPortalFormTemplates = () => {
  return useQuery<FormTemplate[]>({
    queryKey: ["ngo-portal-form-templates"],
    enabled: !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("form_templates")
        .select("*")
        .eq("is_active", true)
        .eq("form_audience" as never, "ngo_portal" as never)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as FormTemplate[];
    },
  });
};
