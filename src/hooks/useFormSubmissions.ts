import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';
import { ModuleType } from '@/hooks/useWorkItems';
import { createWorkItemForSubmission } from '@/lib/createWorkItemForSubmission';

export interface FormSubmission {
  id: string;
  form_template_id: string;
  ngo_id: string | null;
  work_item_id: string | null;
  submitted_by_user_id: string | null;
  payload_json: Json;
  submission_status: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  form_template?: {
    name: string;
    module: string;
  };
}

export interface CreateFormSubmissionInput {
  form_template_id: string;
  ngo_id?: string;
  work_item_id?: string;
  submitted_by_user_id?: string;
  payload_json?: Json;
  submission_status?: string;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useFormSubmissions = (filters?: { ngo_id?: string; form_template_id?: string }) => {
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
      
      // #region agent log - capture raw input
      fetch('http://127.0.0.1:7242/ingest/611bc9d1-427e-4c48-9b30-3ae32ef68254',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFormSubmissions.ts:125',message:'Raw input before sanitization',data:{input:input,input_keys:Object.keys(input),payload_json_type:typeof input.payload_json,payload_json_keys:input.payload_json&&typeof input.payload_json==='object'?Object.keys(input.payload_json):null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,D'})}).catch(()=>{});
      // #endregion
      
      // Sanitize input to only include valid database columns
      // All form field values MUST be in payload_json, not as top-level keys
      const sanitizedInput: Record<string, unknown> = {};
      if (input.form_template_id) sanitizedInput.form_template_id = input.form_template_id;
      // Use 'in' operator to check if key exists (even if value is undefined)
      if ('ngo_id' in input) sanitizedInput.ngo_id = input.ngo_id || null;
      if ('work_item_id' in input) sanitizedInput.work_item_id = input.work_item_id || null;
      if ('submitted_by_user_id' in input) sanitizedInput.submitted_by_user_id = input.submitted_by_user_id || null;
      if ('payload_json' in input) sanitizedInput.payload_json = input.payload_json;
      if ('submission_status' in input) sanitizedInput.submission_status = input.submission_status;
      
      // First, create the form submission
      console.log('[useCreateFormSubmission] Inserting form submission into database', {
        sanitized_keys: Object.keys(sanitizedInput),
      });
      const { data: submission, error: submissionError } = await supabase
        .from('form_submissions')
        .insert(sanitizedInput)
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

      // If form is submitted (not draft) and no work_item_id exists, create a work item
      // Note: work_item_id can be undefined (not passed) or explicitly null/undefined
      // Check explicitly: if work_item_id is null, undefined, or empty string, create work item
      const hasWorkItemId = input.work_item_id && typeof input.work_item_id === 'string' && input.work_item_id.trim() !== '';
      const shouldCreateWorkItem = 
        input.submission_status === 'submitted' && 
        !hasWorkItemId && 
        !!user?.id;

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

        // Fetch the form template to get module and name
        const { data: template, error: templateError } = await supabase
          .from('form_templates')
          .select('module, name')
          .eq('id', input.form_template_id)
          .single();

        if (templateError) {
          const errorDetails = {
            step: 'fetch_form_template',
            error: templateError,
            code: templateError.code,
            message: templateError.message,
            details: templateError.details,
            hint: templateError.hint,
            form_template_id: input.form_template_id,
          };
          console.error('[useCreateFormSubmission] Error fetching form template:', errorDetails);
          
          let errorMessage = `Failed to fetch form template: ${templateError.message}`;
          if (templateError.code) {
            errorMessage += ` (code: ${templateError.code})`;
          }
          if (templateError.details) {
            errorMessage += `\nDetails: ${templateError.details}`;
          }
          
          const error = new Error(errorMessage);
          (error as any).supabaseError = templateError;
          throw error;
        }

        if (!template) {
          throw new Error('Form template not found');
        }

        // Get NGO name if ngo_id is provided
        let ngoName: string | null = null;
        if (input.ngo_id) {
          const { data: ngo } = await supabase
            .from('ngos')
            .select('common_name, legal_name')
            .eq('id', input.ngo_id)
            .maybeSingle();
          
          ngoName = ngo?.common_name || ngo?.legal_name || null;
        }

        // Create work item using helper function
        console.log('[useCreateFormSubmission] Calling createWorkItemForSubmission', {
          templateName: template.name,
          templateModule: template.module,
          ngoId: input.ngo_id,
          ngoName: ngoName,
          userId: user.id,
        });

        let workItemId: string;
        try {
          const result = await createWorkItemForSubmission({
            formTemplateId: input.form_template_id,
            formTemplateName: template.name,
            formTemplateModule: template.module as ModuleType,
            ngoId: input.ngo_id || null,
            ngoName: ngoName,
            payloadJson: input.payload_json,
            userId: user.id,
          });
          workItemId = result.workItemId;
          console.log('[useCreateFormSubmission] Work item created successfully', { workItemId });
        } catch (error) {
          const errorDetails = {
            step: 'create_work_item',
            error,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            supabaseError: (error as any).supabaseError,
          };
          console.error('[useCreateFormSubmission] Work item creation failed:', errorDetails);
          
          // Rollback: Delete the form submission since work item creation failed
          console.log('[useCreateFormSubmission] Rolling back form submission due to work item creation failure', {
            submission_id: submission.id,
          });
          try {
            await supabase
              .from('form_submissions')
              .delete()
              .eq('id', submission.id);
            console.log('[useCreateFormSubmission] Form submission rolled back successfully');
          } catch (rollbackError) {
            console.error('[useCreateFormSubmission] Failed to rollback form submission:', rollbackError);
            // Continue to throw original error even if rollback fails
          }
          
          throw error; // Re-throw to fail the form submission
        }

        // Update form submission with work_item_id
        console.log('[useCreateFormSubmission] Updating form submission with work_item_id', {
          submission_id: submission.id,
          work_item_id: workItemId,
        });

        const { data: updatedSubmission, error: updateError } = await supabase
          .from('form_submissions')
          .update({ work_item_id: workItemId })
          .eq('id', submission.id)
          .select()
          .single();

        if (updateError) {
          const errorDetails = {
            step: 'update_form_submission_work_item_id',
            error: updateError,
            code: updateError.code,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            submission_id: submission.id,
            work_item_id: workItemId,
          };
          console.error('[useCreateFormSubmission] Error linking work item to form submission:', errorDetails);
          
          // Build a detailed error message
          let errorMessage = `Work item created but failed to link to form submission: ${updateError.message}`;
          if (updateError.code) {
            errorMessage += ` (code: ${updateError.code})`;
          }
          if (updateError.details) {
            errorMessage += `\nDetails: ${updateError.details}`;
          }
          if (updateError.hint) {
            errorMessage += `\nHint: ${updateError.hint}`;
          }
          
          const error = new Error(errorMessage);
          (error as any).supabaseError = updateError;
          throw error;
        }

        console.log('[useCreateFormSubmission] Form submission updated with work_item_id', {
          submission_id: updatedSubmission?.id,
          work_item_id: updatedSubmission?.work_item_id,
        });

        // Return updated submission with work_item_id
        return (updatedSubmission || submission) as FormSubmission;
      } else {
        // Log why work item wasn't created
        console.log('[useCreateFormSubmission] Skipping work item creation', {
          submission_status: input.submission_status,
          work_item_id: input.work_item_id,
          user_id: user?.id,
          reason: !input.submission_status || input.submission_status !== 'submitted' 
            ? 'not submitted' 
            : input.work_item_id 
            ? 'work_item_id already exists' 
            : !user?.id 
            ? 'no user' 
            : 'unknown',
        });
      }

      return submission as FormSubmission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-queue-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['department-queue-work-items'] });
      toast({
        title: 'Form submitted',
        description: 'Your form has been submitted and a work item has been created.',
      });
    },
    onError: (error) => {
      const errorDetails = {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        supabaseError: (error as any).supabaseError,
      };
      console.error('[useCreateFormSubmission] onError handler called', errorDetails);
      
      // Extract detailed error message
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
      
      // Fetch current submission to check if we're transitioning from draft to submitted
      const { data: currentSubmission, error: fetchError } = await supabase
        .from('form_submissions')
        .select('submission_status, work_item_id, form_template_id, ngo_id, payload_json')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        const errorDetails = {
          step: 'fetch_current_submission',
          error: fetchError,
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          submission_id: id,
        };
        console.error('[useUpdateFormSubmission] Error fetching current submission:', errorDetails);
        
        let errorMessage = `Failed to fetch form submission: ${fetchError.message}`;
        if (fetchError.code) {
          errorMessage += ` (code: ${fetchError.code})`;
        }
        if (fetchError.details) {
          errorMessage += `\nDetails: ${fetchError.details}`;
        }
        
        const error = new Error(errorMessage);
        (error as any).supabaseError = fetchError;
        throw error;
      }

      // Sanitize input to only include valid database columns
      // All form field values MUST be in payload_json, not as top-level keys
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
      
      // Update the form submission
      console.log('[useUpdateFormSubmission] Updating form submission', {
        submission_id: id,
        sanitized_keys: Object.keys(sanitizedUpdate),
      });
      const { data: submission, error: updateError } = await supabase
        .from('form_submissions')
        .update(sanitizedUpdate)
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) {
        const errorDetails = {
          step: 'update_form_submission',
          error: updateError,
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          submission_id: id,
        };
        console.error('[useUpdateFormSubmission] Error updating form submission:', errorDetails);
        
        let errorMessage = `Failed to update form submission: ${updateError.message}`;
        if (updateError.code) {
          errorMessage += ` (code: ${updateError.code})`;
        }
        if (updateError.details) {
          errorMessage += `\nDetails: ${updateError.details}`;
        }
        
        const error = new Error(errorMessage);
        (error as any).supabaseError = updateError;
        throw error;
      }

      // If transitioning from draft to submitted and no work item exists, create one
      const isTransitioningToSubmitted = 
        currentSubmission?.submission_status !== 'submitted' && 
        input.submission_status === 'submitted';
      
      const hasExistingWorkItem = currentSubmission?.work_item_id && 
        typeof currentSubmission.work_item_id === 'string' && 
        currentSubmission.work_item_id.trim() !== '';
      
      if (isTransitioningToSubmitted && !hasExistingWorkItem && user?.id && currentSubmission?.form_template_id) {
        console.log('[useUpdateFormSubmission] Creating work item for draft→submitted transition', {
          submission_id: id,
          form_template_id: currentSubmission.form_template_id,
          ngo_id: currentSubmission.ngo_id,
          user_id: user.id,
        });
        // Fetch the form template to get module and name
        const { data: template, error: templateError } = await supabase
          .from('form_templates')
          .select('module, name')
          .eq('id', currentSubmission.form_template_id)
          .single();

        if (templateError) {
          const errorDetails = {
            step: 'fetch_form_template',
            error: templateError,
            code: templateError.code,
            message: templateError.message,
            details: templateError.details,
            hint: templateError.hint,
            form_template_id: currentSubmission.form_template_id,
          };
          console.error('[useUpdateFormSubmission] Error fetching form template:', errorDetails);
          
          let errorMessage = `Failed to fetch form template: ${templateError.message}`;
          if (templateError.code) {
            errorMessage += ` (code: ${templateError.code})`;
          }
          if (templateError.details) {
            errorMessage += `\nDetails: ${templateError.details}`;
          }
          
          const error = new Error(errorMessage);
          (error as any).supabaseError = templateError;
          throw error;
        }

        if (!template) {
          throw new Error('Form template not found');
        }

        // Get NGO name if ngo_id is provided
        let ngoName: string | null = null;
        if (currentSubmission.ngo_id) {
          const { data: ngo, error: ngoError } = await supabase
            .from('ngos')
            .select('common_name, legal_name')
            .eq('id', currentSubmission.ngo_id)
            .maybeSingle();
          
          if (ngoError) {
            console.warn('[useUpdateFormSubmission] Error fetching NGO name:', ngoError);
            // Non-critical, continue without NGO name
          } else {
            ngoName = ngo?.common_name || ngo?.legal_name || null;
          }
        }

        // Create work item using helper function
        let workItemId: string;
        try {
          const result = await createWorkItemForSubmission({
          formTemplateId: currentSubmission.form_template_id,
          formTemplateName: template.name,
          formTemplateModule: template.module as ModuleType,
          ngoId: currentSubmission.ngo_id || null,
          ngoName: ngoName,
          payloadJson: currentSubmission.payload_json,
          userId: user.id,
          });
          workItemId = result.workItemId;
          console.log('[useUpdateFormSubmission] Work item created successfully', { workItemId });
        } catch (error) {
          const errorDetails = {
            step: 'create_work_item',
            error,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            supabaseError: (error as any).supabaseError,
          };
          console.error('[useUpdateFormSubmission] Work item creation failed:', errorDetails);
          throw error; // Re-throw to fail the form submission
        }

        // Update form submission with work_item_id
        console.log('[useUpdateFormSubmission] Updating form submission with work_item_id', {
          submission_id: id,
          work_item_id: workItemId,
        });

        const { error: linkError } = await supabase
          .from('form_submissions')
          .update({ work_item_id: workItemId })
          .eq('id', id);

        if (linkError) {
          const errorDetails = {
            step: 'update_form_submission_work_item_id',
            error: linkError,
            code: linkError.code,
            message: linkError.message,
            details: linkError.details,
            hint: linkError.hint,
            submission_id: id,
            work_item_id: workItemId,
          };
          console.error('[useUpdateFormSubmission] Error linking work item to form submission:', errorDetails);
          
          // Work item was created but linking failed - throw error to fail the submission
          let errorMessage = `Work item created but failed to link to form submission: ${linkError.message}`;
          if (linkError.code) {
            errorMessage += ` (code: ${linkError.code})`;
          }
          if (linkError.details) {
            errorMessage += `\nDetails: ${linkError.details}`;
          }
          
          const error = new Error(errorMessage);
          (error as any).supabaseError = linkError;
          throw error;
        }
      }

      return submission as FormSubmission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-queue-work-items'] });
      queryClient.invalidateQueries({ queryKey: ['department-queue-work-items'] });
      toast({
        title: 'Form updated',
        description: 'Your form has been updated.',
      });
    },
    onError: (error) => {
      const errorDetails = {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        supabaseError: (error as any).supabaseError,
      };
      console.error('[useUpdateFormSubmission] onError handler called', errorDetails);
      
      // Extract detailed error message
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
