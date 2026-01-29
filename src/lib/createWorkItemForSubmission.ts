// Helper function to create a work item from a form submission
// This is called automatically when forms are submitted

import { supabase } from "@/integrations/supabase/client";
import { ModuleType } from "@/hooks/useWorkItems";
import { getDepartmentIdForModule } from "@/utils/moduleToDepartment";
import type { Json } from "@/integrations/supabase/types";

export interface CreateWorkItemForSubmissionParams {
  formTemplateId: string;
  formTemplateName: string;
  formTemplateModule: ModuleType;
  ngoId?: string | null;
  ngoName?: string | null;
  payloadJson?: Json;
  userId: string;
}

export interface CreateWorkItemForSubmissionResult {
  workItemId: string;
  workItemTitle: string;
}

/**
 * Creates a work item from a form submission
 * @param params - Parameters for creating the work item
 * @returns The created work item ID and title
 * @throws Error if work item creation fails
 */
export async function createWorkItemForSubmission(
  params: CreateWorkItemForSubmissionParams
): Promise<CreateWorkItemForSubmissionResult> {
  const {
    formTemplateName,
    formTemplateModule,
    ngoId,
    ngoName,
    payloadJson,
    userId,
  } = params;

  if (!supabase) {
    throw new Error("Supabase client not available");
  }

  // Build work item title
  const workItemTitle = ngoName 
    ? `${formTemplateName} – ${ngoName}`
    : formTemplateName;

  // Build description from payload (first few fields)
  let description: string | null = null;
  if (payloadJson && typeof payloadJson === 'object') {
    const payload = payloadJson as Record<string, unknown>;
    const fields = Object.entries(payload)
      .filter(([key]) => key !== 'documents') // Exclude file metadata
      .slice(0, 3) // First 3 fields
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: ${value.join(', ')}`;
        }
        return `${key}: ${String(value).substring(0, 100)}`;
      });
    
    if (fields.length > 0) {
      description = fields.join('\n');
    }
  }

  // Get department_id for the module
  const departmentId = await getDepartmentIdForModule(formTemplateModule);

  // Create work item using proper Supabase types
  const workItemInput = {
    title: workItemTitle,
    description: description,
    module: formTemplateModule,
    ngo_id: ngoId || null,
    department_id: departmentId,
    owner_user_id: userId,
    created_by_user_id: userId, // Required for RLS
    status: 'Not Started' as const,
    priority: 'Med' as const,
    evidence_required: false,
    type: 'form_submission',
  };

  console.log('[createWorkItemForSubmission] Inserting work item', {
    title: workItemTitle,
    module: formTemplateModule,
    ngo_id: ngoId,
    department_id: departmentId,
    owner_user_id: userId,
    created_by_user_id: userId,
    status: workItemInput.status,
    priority: workItemInput.priority,
    type: workItemInput.type,
  });
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/611bc9d1-427e-4c48-9b30-3ae32ef68254',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'createWorkItemForSubmission.ts:88',message:'Work item input before insert',data:{priority:workItemInput.priority,status:workItemInput.status,priority_type:typeof workItemInput.priority,status_type:typeof workItemInput.status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/611bc9d1-427e-4c48-9b30-3ae32ef68254',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'createWorkItemForSubmission.ts:104',message:'About to insert work item',data:{priority:workItemInput.priority,status:workItemInput.status,fullInput:JSON.stringify(workItemInput)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

  const { data: workItem, error: workItemError } = await supabase
    .from('work_items')
    .insert(workItemInput)
    .select('id')
    .single();
  
  // #region agent log
  if (workItemError) {
    fetch('http://127.0.0.1:7242/ingest/611bc9d1-427e-4c48-9b30-3ae32ef68254',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'createWorkItemForSubmission.ts:110',message:'Work item insert error',data:{error_code:workItemError.code,error_message:workItemError.message,error_details:workItemError.details,priority_sent:workItemInput.priority,status_sent:workItemInput.status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
  }
  // #endregion

  if (workItemError) {
    const errorDetails = {
      error: workItemError,
      code: workItemError.code,
      message: workItemError.message,
      details: workItemError.details,
      hint: workItemError.hint,
      input: workItemInput,
    };
    console.error('[createWorkItemForSubmission] Error creating work item:', errorDetails);
    
    // Build a detailed error message
    let errorMessage = `Failed to create work item: ${workItemError.message}`;
    if (workItemError.code) {
      errorMessage += ` (code: ${workItemError.code})`;
    }
    if (workItemError.details) {
      errorMessage += `\nDetails: ${workItemError.details}`;
    }
    if (workItemError.hint) {
      errorMessage += `\nHint: ${workItemError.hint}`;
    }
    
    const error = new Error(errorMessage);
    (error as any).supabaseError = workItemError;
    throw error;
  }

  if (!workItem || !workItem.id) {
    console.error('[createWorkItemForSubmission] Work item creation returned no ID', { workItem });
    throw new Error('Work item creation returned no ID');
  }

  console.log('[createWorkItemForSubmission] Work item created successfully', {
    work_item_id: workItem.id,
    title: workItemTitle,
  });

  return {
    workItemId: workItem.id,
    workItemTitle: workItemTitle,
  };
}
