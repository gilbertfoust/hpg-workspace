// Utility to map form template modules to org_units department_id
// This maps module_type enum values to department names in org_units table

import { ModuleType } from "@/hooks/useWorkItems";
import { supabase } from "@/integrations/supabase/client";

export const MODULE_TO_DEPARTMENT_MAP: Record<ModuleType, { department_name: string; sub_department_name?: string | null }> = {
  development: { department_name: "Development" },
  finance: { department_name: "Finance" },
  ngo_coordination: { department_name: "Program" }, // NGO Coordination maps to Program
  operations: { department_name: "Operations" },
  marketing: { department_name: "Marketing" },
  communications: { department_name: "Communications" },
  hr: { department_name: "HR" },
  it: { department_name: "IT" },
  legal: { department_name: "Legal" },
  program: { department_name: "Program" },
  curriculum: { department_name: "Program", sub_department_name: "Curriculum" },
  administration: { department_name: "Administration" },
  partnerships: { department_name: "Partnership Development" },
};

/**
 * Get department_id for a given module by querying org_units table
 * @param module - The module_type enum value
 * @returns Promise<string | null> - The department_id UUID or null if not found
 */
export async function getDepartmentIdForModule(module: ModuleType): Promise<string | null> {
  const mapping = MODULE_TO_DEPARTMENT_MAP[module];
  if (!mapping) {
    console.warn(`No department mapping found for module: ${module}`);
    return null;
  }

  if (!supabase) {
    console.warn("Supabase client not available");
    return null;
  }

  let query = supabase
    .from("org_units")
    .select("id")
    .eq("department_name", mapping.department_name);

  if (mapping.sub_department_name) {
    query = query.eq("sub_department_name", mapping.sub_department_name);
  } else {
    query = query.is("sub_department_name", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(`Error fetching department for module ${module}:`, error);
    return null;
  }

  return data?.id || null;
}
