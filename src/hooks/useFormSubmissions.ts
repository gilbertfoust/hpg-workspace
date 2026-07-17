import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database, Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { ModuleType } from '@/hooks/useWorkItems';
import { createWorkItemForSubmission } from '@/lib/createWorkItemForSubmission';
import { createGrantFromFormSubmission } from '@/lib/createGrantFromFormSubmission';
import { completeWorkItemForAdminRecordsWithFallback } from '@/lib/workItemRecordActions';

const MODULE_TO_DOC_CATEGORY: Record<string, string> = {
  ngo_coordination: 'other',
  administration: 'other',
  operations: 'other',
  program: 'program',
  curriculum: 'curriculum',
  development: 'other',
  partnership: 'other',
  marketing: 'marketing',
  communications: 'communications',
  hr: 'hr',
  it: 'it',
  finance: 'finance',
  legal: 'legal',
};

async function createDocumentFromSubmission(
  submission: FormSubmission,
  formTemplateId: string,
  ngoId: string | null,
  userId: string,
  payloadJson: Json | undefined,
) {
  if (!supabase) return;

  // Fetch template name and module
  const { data: template } = await supabase
    .from('form_templates')
    .select('name, module')
    .eq('id', formTemplateId)
    .single();

  const templateName = template?.name || 'Form Submission';
  const module = template?.module || 'other';
  const category = MODULE_TO_DOC_CATEGORY[module] || 'other';

  // Build a JSON document from the submission data
  const docContent = JSON.stringify({
    form_name: templateName,
    submission_id: submission.id,
    submitted_at: new Date().toISOString(),
    data: payloadJson || {},
  }, null, 2);

  const blob = new Blob([docContent], { type: 'application/json' });
  const timestamp = Date.now();
  const safeName = templateName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeName}_${timestamp}.json`;
  const storagePath = ngoId
    ? `${ngoId}/form-submissions/${fileName}`
    : `general/form-submissions/${fileName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('ngo-documents')
    .upload(storagePath, blob, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    console.error('[createDocumentFromSubmission] Storage upload failed:', uploadError);
    throw uploadError;
  }

  // Create document record
  const { error: dbError } = await supabase
    .from('documents')
    .insert({
      file_name: fileName,
      file_path: storagePath,
      file_type: 'application/json',
      file_size: blob.size,
      category: category as any,
      ngo_id: ngoId,
      work_item_id: submission.work_item_id || null,
      uploaded_by_user_id: userId,
      review_status: 'Pending',
    });

  if (dbError) {
    // Cleanup storage on failure
    await supabase.storage.from('ngo-documents').remove([storagePath]);
    throw dbError;
  }
}

export type FormSubmission = Database['public']['Tables']['form_submissions']['Row'] & {
  draft_progress?: number;
  submitted_version?: number | null;
  locked_at?: string | null;
  idempotency_key?: string | null;
  form_template?: {
    name: string;
    module: string;
  };
};

export type CreateFormSubmissionInput = Database['public']['Tables']['form_submissions']['Insert'];

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export interface SaveFormWorkflowInput {
  formTemplateId: string;
  payloadJson: Json;
  ngoId?: string | null;
  submissionId?: string | null;
  progress?: number;
  submit: boolean;
  idempotencyKey?: string;
}

export interface FormWorkflowResult {
  submission: FormSubmission;
  work_item?: { id: string; title: string; department_id?: string | null } | null;
  idempotent_replay?: boolean;
}

/**
 * The canonical form writer. Drafts and submissions intentionally use separate
 * server contracts: saving a draft can never create a work item, while Submit
 * commits the submission and its department-routed work item in one transaction.
 */
export const useSaveFormWorkflow = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: SaveFormWorkflowInput): Promise<FormWorkflowResult> => {
      ensureSupabase();
      if (input.submit) {
        const { data, error } = await supabase.rpc('submit_form_submission_atomic' as never, {
          p_form_template_id: input.formTemplateId,
          p_payload_json: input.payloadJson ?? {},
          p_ngo_id: input.ngoId || null,
          p_submission_id: input.submissionId || null,
          p_idempotency_key: input.idempotencyKey || crypto.randomUUID(),
        } as never);
        if (error) throw error;
        return data as FormWorkflowResult;
      }

      const { data, error } = await supabase.rpc('save_form_draft' as never, {
        p_form_template_id: input.formTemplateId,
        p_payload_json: input.payloadJson ?? {},
        p_ngo_id: input.ngoId || null,
        p_submission_id: input.submissionId || null,
        p_progress: Math.max(0, Math.min(100, Math.round(input.progress ?? 0))),
      } as never);
      if (error) throw error;
      return { submission: data as FormSubmission, work_item: null };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-queue-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['department-queue-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['form-workflow-events'] });
      toast({
        title: variables.submit ? 'Form submitted' : 'Private draft saved',
        description: variables.submit
          ? `A work item was routed to the responsible department${result.work_item?.title ? `: ${result.work_item.title}` : '.'}`
          : 'Only you can see this draft. No work item was created.',
      });
    },
    onError: (error: Error, variables) => {
      toast({
        variant: 'destructive',
        title: variables.submit ? 'Submission failed' : 'Draft save failed',
        description: error.message,
      });
    },
  });
};

export const useFormSubmissions = (filters?: { ngo_id?: string; form_template_id?: string; work_item_id?: string }) => {
  return useQuery({
    queryKey: ['form-submissions', filters],
    queryFn: async () => {
      ensureSupabase();
      let query = supabase
        .from('form_submissions')
        .select(`
          *,
          form_template:form_templates!form_submissions_form_template_id_fkey(name, module)
        `);

      if (filters?.ngo_id) {
        query = query.eq('ngo_id', filters.ngo_id);
      }
      if (filters?.form_template_id) {
        query = query.eq('form_template_id', filters.form_template_id);
      }
      if (filters?.work_item_id) {
        query = query.eq('work_item_id', filters.work_item_id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as FormSubmission[];
    },
  });
};

export interface FormSubmissionWithSchema extends FormSubmission {
  form_template?: {
    name: string;
    module: string;
    schema_json?: {
      fields: Array<{
        name: string;
        type: string;
        label: string;
        required?: boolean;
        options?: string[];
      }>;
    };
  };
}

export const useFormSubmission = (id: string) => {
  return useQuery({
    queryKey: ['form-submissions', 'detail', id],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          form_template:form_templates!form_submissions_form_template_id_fkey(name, module, schema_json)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as FormSubmissionWithSchema;
    },
    enabled: !!id,
  });
};

export const useCreateFormSubmission = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateFormSubmissionInput) => {
      console.log('[useCreateFormSubmission] mutationFn called', {
        form_template_id: input.form_template_id,
        submission_status: input.submission_status,
        work_item_id: input.work_item_id,
        ngo_id: input.ngo_id,
        user_id: user?.id,
        has_payload: !!input.payload_json,
      });

      ensureSupabase();


      const sanitizedInput: Record<string, unknown> = {};
      if (input.form_template_id) sanitizedInput.form_template_id = input.form_template_id;
      if ('ngo_id' in input) sanitizedInput.ngo_id = input.ngo_id || null;
      if ('work_item_id' in input) sanitizedInput.work_item_id = input.work_item_id || null;
      if ('submitted_by_user_id' in input) sanitizedInput.submitted_by_user_id = input.submitted_by_user_id || null;
      if ('payload_json' in input) sanitizedInput.payload_json = input.payload_json;
      if ('submission_status' in input) sanitizedInput.submission_status = input.submission_status;
      if ('submitted_at' in input) sanitizedInput.submitted_at = input.submitted_at ?? null;

      console.log('[useCreateFormSubmission] Inserting form submission into database', {
        sanitized_keys: Object.keys(sanitizedInput),
      });
      const { data: submission, error: submissionError } = await supabase
        .from('form_submissions')
        .insert(sanitizedInput as never)
        .select()
        .single();

      if (submissionError) {
        console.error('[useCreateFormSubmission] Form submission insert failed:', submissionError);
        throw submissionError;
      }

      console.log('[useCreateFormSubmission] Form submission created', {
        submission_id: submission.id,
        submission_status: submission.submission_status,
        work_item_id: submission.work_item_id,
      });

      const hasWorkItemId = input.work_item_id && typeof input.work_item_id === 'string' && input.work_item_id.trim() !== '';
      const shouldCreateWorkItem = input.submission_status === 'submitted' && !hasWorkItemId && !!user?.id;

      console.log('[useCreateFormSubmission] Work item creation check', {
        submission_status: input.submission_status,
        hasWorkItemId,
        work_item_id: input.work_item_id,
        user_id: user?.id,
        shouldCreateWorkItem,
      });

      if (shouldCreateWorkItem) {
        console.log('[useCreateFormSubmission] Creating work item for form submission', {
          form_template_id: input.form_template_id,
          ngo_id: input.ngo_id,
          user_id: user.id,
        });

        const { data: template, error: templateError } = await supabase
          .from('form_templates')
          .select('module, name')
          .eq('id', input.form_template_id)
          .single();

        if (templateError) {
          const error = new Error(`Failed to fetch form template: ${templateError.message}`);
          (error as any).supabaseError = templateError;
          throw error;
        }

        if (!template) {
          throw new Error('Form template not found');
        }

        let ngoName: string | null = null;
        if (input.ngo_id) {
          const { data: ngo } = await supabase
            .from('ngos')
            .select('common_name, legal_name')
            .eq('id', input.ngo_id)
            .maybeSingle();

          ngoName = ngo?.common_name || ngo?.legal_name || null;
        }

        let workItemId: string;
        try {
          const result = await createWorkItemForSubmission({
            formTemplateId: input.form_template_id,
            formTemplateName: template.name,
            formTemplateModule: template.module as ModuleType,
            ngoId: input.ngo_id || null,
            ngoName,
            payloadJson: input.payload_json,
            userId: user.id,
          });
          workItemId = result.workItemId;
        } catch (error) {
          try {
            await supabase.from('form_submissions').delete().eq('id', submission.id);
          } catch {
            // Keep original error if rollback fails.
          }
          throw error;
        }

        const { data: updatedSubmission, error: updateError } = await supabase
          .from('form_submissions')
          .update({ work_item_id: workItemId })
          .eq('id', submission.id)
          .select()
          .single();

        if (updateError) {
          const error = new Error(`Work item created but failed to link to form submission: ${updateError.message}`);
          (error as any).supabaseError = updateError;
          throw error;
        }

        const finalWithWorkItem = (updatedSubmission || submission) as FormSubmission;

        // Auto-create grant application if this is a grant suggestion form
        try {
          await createGrantFromFormSubmission({
            formTemplateName: template.name,
            ngoId: input.ngo_id || null,
            payloadJson: input.payload_json && typeof input.payload_json === 'object' && !Array.isArray(input.payload_json)
              ? input.payload_json as Record<string, unknown>
              : null,
          });
        } catch (e) {
          console.warn('[useFormSubmissions] Grant auto-creation failed (non-blocking):', e);
        }

        // Also create a document record for the submission
        if (user?.id) {
          try {
            await createDocumentFromSubmission(
              finalWithWorkItem,
              input.form_template_id,
              input.ngo_id || null,
              user.id,
              input.payload_json,
            );
            console.log('[useCreateFormSubmission] Document created for submission with work item');
          } catch (docError) {
            console.error('[useCreateFormSubmission] Failed to create document (non-fatal):', docError);
          }
        }

        return finalWithWorkItem;
      }

      const finalSubmission = submission as FormSubmission;

      // Create a document record for submitted forms
      if (input.submission_status === 'submitted' && user?.id) {
        try {
          await createDocumentFromSubmission(
            finalSubmission,
            input.form_template_id,
            input.ngo_id || null,
            user.id,
            input.payload_json,
          );
          console.log('[useCreateFormSubmission] Document created for submission');
        } catch (docError) {
          console.error('[useCreateFormSubmission] Failed to create document (non-fatal):', docError);
        }
      }

      return finalSubmission;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-queue-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['department-queue-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: variables.submission_status === 'submitted' ? 'Form submitted' : 'Draft saved',
        description:
          variables.submission_status === 'submitted'
            ? 'Your form has been submitted and a work item has been created.'
            : 'Your draft has been saved.',
      });
    },
    onError: (error) => {
      let errorMessage = error instanceof Error ? error.message : String(error);
      const supabaseError = (error as any).supabaseError;
      if (supabaseError) {
        errorMessage = errorMessage || supabaseError.message || 'Unknown error';
        if (supabaseError.details) {
          errorMessage += `\n${supabaseError.details}`;
        }
        if (supabaseError.hint) {
          errorMessage += `\n${supabaseError.hint}`;
        }
      }

      toast({
        variant: 'destructive',
        title: 'Error saving form',
        description: errorMessage,
      });
    },
  });
};

export const useUpdateFormSubmission = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<FormSubmission> & { id: string }) => {
      ensureSupabase();

      const { data: currentSubmission, error: fetchError } = await supabase
        .from('form_submissions')
        .select('submission_status, work_item_id, form_template_id, ngo_id, payload_json')
        .eq('id', id)
        .single();

      if (fetchError) {
        const error = new Error(`Failed to fetch form submission: ${fetchError.message}`);
        (error as any).supabaseError = fetchError;
        throw error;
      }

      const sanitizedUpdate: Record<string, unknown> = {};
      const validKeys = [
        'form_template_id',
        'work_item_id',
        'ngo_id',
        'submitted_by_user_id',
        'payload_json',
        'submitted_at',
        'submission_status',
        'created_at',
        'updated_at',
      ];

      for (const key of validKeys) {
        if (key in input && input[key as keyof typeof input] !== undefined) {
          sanitizedUpdate[key] = input[key as keyof typeof input];
        }
      }

      if (Object.keys(sanitizedUpdate).length === 0) {
        return currentSubmission as FormSubmission;
      }

      const { data: submission, error: updateError } = await supabase
        .from('form_submissions')
        .update(sanitizedUpdate)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        const error = new Error(`Failed to update form submission: ${updateError.message}`);
        (error as any).supabaseError = updateError;
        throw error;
      }

      const isTransitioningToSubmitted =
        currentSubmission?.submission_status !== 'submitted' &&
        input.submission_status === 'submitted';

      const hasExistingWorkItem =
        currentSubmission?.work_item_id &&
        typeof currentSubmission.work_item_id === 'string' &&
        currentSubmission.work_item_id.trim() !== '';

      if (isTransitioningToSubmitted && !hasExistingWorkItem && user?.id && currentSubmission?.form_template_id) {
        const { data: template, error: templateError } = await supabase
          .from('form_templates')
          .select('module, name')
          .eq('id', currentSubmission.form_template_id)
          .single();

        if (templateError) {
          const error = new Error(`Failed to fetch form template: ${templateError.message}`);
          (error as any).supabaseError = templateError;
          throw error;
        }

        if (!template) {
          throw new Error('Form template not found');
        }

        let ngoName: string | null = null;
        if (currentSubmission.ngo_id) {
          const { data: ngo } = await supabase
            .from('ngos')
            .select('common_name, legal_name')
            .eq('id', currentSubmission.ngo_id)
            .maybeSingle();
          ngoName = ngo?.common_name || ngo?.legal_name || null;
        }

        const result = await createWorkItemForSubmission({
          formTemplateId: currentSubmission.form_template_id,
          formTemplateName: template.name,
          formTemplateModule: template.module as ModuleType,
          ngoId: currentSubmission.ngo_id || null,
          ngoName,
          payloadJson: currentSubmission.payload_json,
          userId: user.id,
        });

        const { error: linkError } = await supabase
          .from('form_submissions')
          .update({ work_item_id: result.workItemId })
          .eq('id', id);

        if (linkError) {
          const error = new Error(`Work item created but failed to link to form submission: ${linkError.message}`);
          (error as any).supabaseError = linkError;
          throw error;
        }
      }

      // Create a document record when transitioning to submitted
      if (isTransitioningToSubmitted && user?.id && currentSubmission?.form_template_id) {
        try {
          await createDocumentFromSubmission(
            submission as FormSubmission,
            currentSubmission.form_template_id,
            currentSubmission.ngo_id || null,
            user.id,
            input.payload_json ?? currentSubmission.payload_json,
          );
          console.log('[useUpdateFormSubmission] Document created for submission');
        } catch (docError) {
          console.error('[useUpdateFormSubmission] Failed to create document (non-fatal):', docError);
        }
      }

      return submission as FormSubmission;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-queue-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['department-queue-work-items'] });
      toast({
        title: variables.submission_status === 'submitted' ? 'Form submitted' : 'Draft updated',
        description:
          variables.submission_status === 'submitted'
            ? 'Your form has been submitted.'
            : 'Your draft has been updated.',
      });
    },
    onError: (error) => {
      let errorMessage = error instanceof Error ? error.message : String(error);
      const supabaseError = (error as any).supabaseError;
      if (supabaseError) {
        errorMessage = errorMessage || supabaseError.message || 'Unknown error';
        if (supabaseError.details) {
          errorMessage += `\n${supabaseError.details}`;
        }
        if (supabaseError.hint) {
          errorMessage += `\n${supabaseError.hint}`;
        }
      }

      toast({
        variant: 'destructive',
        title: 'Error updating form',
        description: errorMessage,
      });
    },
  });
};

export const useArchiveFormSubmission = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, workItemId }: { id: string; workItemId?: string | null }) => {
      const client = ensureSupabase();

      if (workItemId) {
        await completeWorkItemForAdminRecordsWithFallback(
          client,
          workItemId,
          "Form submission moved to admin records",
        );
      }

      const { error } = await client
        .from("form_submissions")
        .update({
          submission_status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      queryClient.invalidateQueries({ queryKey: ["work-item-admin-records"] });
      toast({
        title: "Form moved to admin records",
        description: "The linked work item was archived and the submission was marked archived.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Unable to archive form submission",
        description: error instanceof Error ? error.message : "Archive failed. The submission was not removed.",
      });
    },
  });
};

export const useDeleteFormSubmission = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      ensureSupabase();

      const { error } = await supabase
        .from('form_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast({
        title: 'Form submission deleted',
        description: 'The form submission has been successfully deleted.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error deleting form submission',
        description: error instanceof Error ? error.message : 'Unable to delete form submission. Please try again.',
      });
    },
  });
};
