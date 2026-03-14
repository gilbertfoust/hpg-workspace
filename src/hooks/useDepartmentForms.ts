import { useQuery } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { ModuleType } from './useWorkItems';
import { MODULE_TO_DEPARTMENT_MAP } from '@/utils/moduleToDepartment';

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

/**
 * Get form templates for a specific department
 * Maps department to modules and fetches templates for those modules
 */
export const useDepartmentFormTemplates = (departmentName?: string, subDepartmentName?: string | null) => {
  return useQuery({
    queryKey: ['department-form-templates', departmentName, subDepartmentName],
    queryFn: async () => {
      ensureSupabase();
      
      if (!departmentName) return [];
      
      // Find all modules that map to this department
      const matchingModules: ModuleType[] = [];
      for (const [module, mapping] of Object.entries(MODULE_TO_DEPARTMENT_MAP)) {
        if (mapping.department_name === departmentName) {
          // Check sub_department match
          if (subDepartmentName) {
            if (mapping.sub_department_name === subDepartmentName) {
              matchingModules.push(module as ModuleType);
            }
          } else if (!mapping.sub_department_name) {
            matchingModules.push(module as ModuleType);
          }
        }
      }
      
      if (matchingModules.length === 0) return [];
      
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .in('module', matchingModules)
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!departmentName,
  });
};

/**
 * Get form submissions for a specific department
 * Includes the template data to determine department routing
 */
export const useDepartmentFormSubmissions = (departmentName?: string, subDepartmentName?: string | null) => {
  return useQuery({
    queryKey: ['department-form-submissions', departmentName, subDepartmentName],
    queryFn: async () => {
      ensureSupabase();
      
      if (!departmentName) return [];
      
      // Find all modules that map to this department
      const matchingModules: ModuleType[] = [];
      for (const [module, mapping] of Object.entries(MODULE_TO_DEPARTMENT_MAP)) {
        if (mapping.department_name === departmentName) {
          if (subDepartmentName) {
            if (mapping.sub_department_name === subDepartmentName) {
              matchingModules.push(module as ModuleType);
            }
          } else if (!mapping.sub_department_name) {
            matchingModules.push(module as ModuleType);
          }
        }
      }
      
      if (matchingModules.length === 0) return [];
      
      const { data, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          form_template:form_templates(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Filter by matching modules
      const filtered = (data || []).filter(submission => {
        const template = submission.form_template as any;
        return template && matchingModules.includes(template.module);
      });
      
      return filtered;
    },
    enabled: !!departmentName,
  });
};
