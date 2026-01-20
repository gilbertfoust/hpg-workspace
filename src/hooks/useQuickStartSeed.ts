import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ModuleType, WorkItemStatus, Priority } from '@/hooks/useWorkItems';

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

const sampleNgos = [
  {
    legal_name: 'Detroit Community Reach',
    common_name: 'Detroit Community Reach',
    city: 'Detroit',
    state_province: 'MI',
    country: 'USA',
    fiscal_type: 'model_c',
    status: 'active',
    website: 'https://detroitcommunityreach.org',
    notes: 'Demo NGO focused on youth development and community outreach.',
  },
  {
    legal_name: 'Chicago Food Alliance',
    common_name: 'Chicago Food Alliance',
    city: 'Chicago',
    state_province: 'IL',
    country: 'USA',
    fiscal_type: 'model_c',
    status: 'onboarding',
    website: 'https://chicagofoodalliance.org',
    notes: 'Demo NGO supporting food access and pantry operations.',
  },
  {
    legal_name: 'Ghana Health Partners',
    common_name: 'Ghana Health Partners',
    city: 'Accra',
    state_province: 'Greater Accra',
    country: 'Ghana',
    fiscal_type: 'model_c',
    status: 'active',
    website: 'https://ghanahealthpartners.org',
    notes: 'Demo NGO supporting community health initiatives.',
  },
  {
    legal_name: 'Nairobi Education Collective',
    common_name: 'Nairobi Education Collective',
    city: 'Nairobi',
    state_province: 'Nairobi County',
    country: 'Kenya',
    fiscal_type: 'model_c',
    status: 'active',
    website: 'https://nairobiexample.org',
    notes: 'Demo NGO focused on education and mentoring programs.',
  },
];

const sampleFormTemplates = [
  {
    name: 'Base Onboarding (Model C)',
    description: 'Baseline onboarding form for Model C NGOs.',
    module: 'ngo_coordination' as ModuleType,
    schema_json: {
      fields: [
        { name: 'legal_name', type: 'text', label: 'Legal Name', required: true },
        { name: 'common_name', type: 'text', label: 'Common Name' },
        { name: 'primary_contact', type: 'text', label: 'Primary Contact' },
        { name: 'email', type: 'email', label: 'Primary Contact Email', required: true },
        { name: 'website', type: 'url', label: 'Website' },
        { name: 'mission', type: 'textarea', label: 'Mission Summary' },
      ],
    },
    mapping_json: {
      fields: {
        legal_name: 'legal_name',
        common_name: 'common_name',
        website: 'website',
      },
    },
  },
  {
    name: 'Monthly NGO Upkeep',
    description: 'Monthly check-in form for ongoing NGO upkeep.',
    module: 'ngo_coordination' as ModuleType,
    schema_json: {
      fields: [
        { name: 'month', type: 'date', label: 'Reporting Month', required: true },
        { name: 'key_updates', type: 'textarea', label: 'Key Updates', required: true },
        { name: 'risks', type: 'textarea', label: 'Risks / Blockers' },
        { name: 'support_needed', type: 'textarea', label: 'Support Needed from HPG' },
      ],
    },
    mapping_json: {
      fields: {
        month: 'reporting_month',
        key_updates: 'updates',
      },
    },
  },
  {
    name: 'Annual Compliance (Base)',
    description: 'Annual compliance check for standard NGO reporting.',
    module: 'legal' as ModuleType,
    schema_json: {
      fields: [
        { name: 'fiscal_year', type: 'text', label: 'Fiscal Year', required: true },
        { name: 'audit_status', type: 'select', label: 'Audit Status', options: ['Complete', 'In Progress', 'Not Started'], required: true },
        { name: 'filings', type: 'textarea', label: 'Required Filings', required: true },
        { name: 'notes', type: 'textarea', label: 'Additional Notes' },
      ],
    },
    mapping_json: {
      fields: {
        fiscal_year: 'fiscal_year',
        audit_status: 'audit_status',
      },
    },
  },
  {
    name: 'Offboarding (Base)',
    description: 'Offboarding checklist for NGOs exiting the program.',
    module: 'ngo_coordination' as ModuleType,
    schema_json: {
      fields: [
        { name: 'offboarding_date', type: 'date', label: 'Offboarding Date', required: true },
        { name: 'final_reports', type: 'checkbox', label: 'Final Reports Submitted' },
        { name: 'asset_transfer', type: 'checkbox', label: 'Assets Transferred' },
        { name: 'notes', type: 'textarea', label: 'Notes' },
      ],
    },
    mapping_json: {
      fields: {
        offboarding_date: 'offboarding_date',
      },
    },
  },
];

const onboardingWorkItems: Array<{
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: Priority;
  module: ModuleType;
  type: string;
  offsetDays: number;
}> = [
  {
    title: 'Onboarding kickoff call',
    description: 'Host kickoff call and review onboarding timeline.',
    status: 'complete',
    priority: 'medium',
    module: 'ngo_coordination',
    type: 'onboarding',
    offsetDays: -10,
  },
  {
    title: 'Collect onboarding documents',
    description: 'Gather governance docs, bylaws, and registration records.',
    status: 'in_progress',
    priority: 'high',
    module: 'ngo_coordination',
    type: 'onboarding',
    offsetDays: 7,
  },
];

const monthlyWorkItems: Array<{
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: Priority;
  module: ModuleType;
  type: string;
  offsetDays: number;
}> = [
  {
    title: 'Monthly NGO update',
    description: 'Collect monthly narrative updates and KPIs.',
    status: 'not_started',
    priority: 'medium',
    module: 'ngo_coordination',
    type: 'monthly_upkeep',
    offsetDays: 14,
  },
  {
    title: 'Monthly financial reconciliation',
    description: 'Review expenses and reconcile monthly spend.',
    status: 'waiting_on_ngo',
    priority: 'low',
    module: 'finance',
    type: 'monthly_upkeep',
    offsetDays: 21,
  },
];

const formatDateOffset = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
};

export const useQuickStartSeed = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createSampleNgos = async () => {
    ensureSupabase();
    if (!user?.id) {
      throw new Error('You must be signed in to seed data.');
    }

    const ngoNames = sampleNgos.map((ngo) => ngo.legal_name);
    const { data: existingNgos, error } = await supabase
      .from('ngos')
      .select('id, legal_name')
      .in('legal_name', ngoNames);

    if (error) throw error;

    const existingNames = new Set((existingNgos ?? []).map((ngo) => ngo.legal_name));
    const missingNgos = sampleNgos.filter((ngo) => !existingNames.has(ngo.legal_name));

    if (missingNgos.length > 0) {
      const { error: insertError } = await supabase.from('ngos').insert(missingNgos);
      if (insertError) throw insertError;
    }

    await queryClient.invalidateQueries({ queryKey: ['ngos'] });

    return {
      created: missingNgos.length,
      skipped: existingNames.size,
    };
  };

  const createBaseFormTemplates = async () => {
    ensureSupabase();
    if (!user?.id) {
      throw new Error('You must be signed in to seed data.');
    }

    const templateNames = sampleFormTemplates.map((template) => template.name);
    const { data: existingTemplates, error } = await supabase
      .from('form_templates')
      .select('id, name')
      .in('name', templateNames);

    if (error) throw error;

    const existingNames = new Set((existingTemplates ?? []).map((template) => template.name));
    const missingTemplates = sampleFormTemplates
      .filter((template) => !existingNames.has(template.name))
      .map((template) => ({
        ...template,
        is_active: true,
        version: 1,
        created_by_user_id: user.id,
      }));

    if (missingTemplates.length > 0) {
      const { error: insertError } = await supabase.from('form_templates').insert(missingTemplates);
      if (insertError) throw insertError;
    }

    await queryClient.invalidateQueries({ queryKey: ['form-templates'] });

    return {
      created: missingTemplates.length,
      skipped: existingNames.size,
    };
  };

  const generateSampleWorkItems = async () => {
    ensureSupabase();
    if (!user?.id) {
      throw new Error('You must be signed in to seed data.');
    }

    const ngoNames = sampleNgos.map((ngo) => ngo.legal_name);
    const { data: ngos, error } = await supabase
      .from('ngos')
      .select('id, legal_name')
      .in('legal_name', ngoNames);

    if (error) throw error;

    const ngoIds = (ngos ?? []).map((ngo) => ngo.id);
    if (ngoIds.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const workItemTemplates = [...onboardingWorkItems, ...monthlyWorkItems];

    const workItemsToCreate = ngos.flatMap((ngo) =>
      workItemTemplates.map((template) => ({
        ngo_id: ngo.id,
        module: template.module,
        title: template.title,
        description: template.description,
        status: template.status,
        priority: template.priority,
        type: template.type,
        start_date: formatDateOffset(template.offsetDays - 3),
        due_date: formatDateOffset(template.offsetDays),
        created_by_user_id: user.id,
      })),
    );

    const titles = [...new Set(workItemsToCreate.map((item) => item.title))];

    const { data: existingWorkItems, error: existingError } = await supabase
      .from('work_items')
      .select('id, ngo_id, title')
      .in('ngo_id', ngoIds)
      .in('title', titles);

    if (existingError) throw existingError;

    const existingPairs = new Set(
      (existingWorkItems ?? []).map((item) => `${item.ngo_id}|${item.title}`),
    );

    const missingWorkItems = workItemsToCreate.filter(
      (item) => !existingPairs.has(`${item.ngo_id}|${item.title}`),
    );

    if (missingWorkItems.length > 0) {
      const { error: insertError } = await supabase.from('work_items').insert(missingWorkItems);
      if (insertError) throw insertError;
    }

    await queryClient.invalidateQueries({ queryKey: ['work-items'] });
    await queryClient.invalidateQueries({ queryKey: ['work-item-stats'] });

    return {
      created: missingWorkItems.length,
      skipped: existingPairs.size,
    };
  };

  return {
    createSampleNgos,
    createBaseFormTemplates,
    generateSampleWorkItems,
  };
};

export type QuickStartSeedAction = 'ngos' | 'templates' | 'work-items';
export type QuickStartSeedResult = { created: number; skipped: number };
