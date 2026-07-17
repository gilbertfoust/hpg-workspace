import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import type { ModuleType } from '@/hooks/useWorkItems';

export type DocumentCategory = Database['public']['Enums']['document_category'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type CreateDocumentInput = Database['public']['Tables']['documents']['Insert'];

const BUCKET_NAME = 'ngo-documents';

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

const invalidateDocumentQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['documents'] });
  queryClient.invalidateQueries({ queryKey: ['portal-documents'] });
  queryClient.invalidateQueries({ queryKey: ['form-template-documents'] });
  queryClient.invalidateQueries({ queryKey: ['work-items'] });
  queryClient.invalidateQueries({ queryKey: ['portal-work-items'] });
};

export const useDocuments = (filters?: {
  ngo_id?: string;
  work_item_id?: string;
  form_template_id?: string;
  module?: ModuleType;
  category?: DocumentCategory;
}) => {
  return useQuery({
    queryKey: ['documents', filters],
    queryFn: async () => {
      ensureSupabase();
      let query = supabase.from('documents').select('*');
      
      if (filters?.ngo_id) {
        query = query.eq('ngo_id', filters.ngo_id);
      }
      if (filters?.work_item_id) {
        query = query.eq('work_item_id', filters.work_item_id);
      }
      if (filters?.form_template_id) {
        query = query.eq('form_template_id' as never, filters.form_template_id as never);
      }
      if (filters?.module) {
        query = query.eq('module' as never, filters.module as never);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      
      const { data, error } = await query.order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      return data as Document[];
    },
  });
};

export const useDocument = (id: string) => {
  return useQuery({
    queryKey: ['documents', 'detail', id],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Document not found');
      return data as Document;
    },
    enabled: !!id,
  });
};

export const useCreateDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateDocumentInput) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('documents')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data as Document;
    },
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      toast({
        title: 'Document uploaded',
        description: 'The document has been successfully uploaded.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error uploading document',
        description: error.message,
      });
    },
  });
};

export const useUpdateDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Document> & { id: string }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('documents')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Document;
    },
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      toast({
        title: 'Document updated',
        description: 'The document has been successfully updated.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error updating document',
        description: error.message,
      });
    },
  });
};

export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      file,
      ngoId,
      category,
      workItemId,
      reviewStatus,
    }: {
      file: File;
      ngoId: string;
      category: DocumentCategory;
      workItemId?: string;
      reviewStatus?: string;
    }) => {
      ensureSupabase();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to upload documents');

      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${ngoId}/${timestamp}_${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });

      if (uploadError) throw uploadError;

      const { data, error: dbError } = await supabase
        .from('documents')
        .insert({
          file_name: file.name,
          file_path: filePath,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          category,
          ngo_id: ngoId,
          work_item_id: workItemId || null,
          uploaded_by_user_id: user.id,
          review_status: reviewStatus ?? 'Pending',
        })
        .select()
        .single();

      if (dbError) {
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        throw dbError;
      }

      return data as Document;
    },
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      toast({
        title: 'Document uploaded',
        description: 'The document has been successfully uploaded.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error uploading document',
        description: error.message,
      });
    },
  });
};

export const useUploadFormTemplateDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      file,
      formTemplateId,
      module,
      category,
      reviewStatus,
    }: {
      file: File;
      formTemplateId: string;
      module: ModuleType;
      category: DocumentCategory;
      reviewStatus?: string;
    }) => {
      ensureSupabase();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to upload department form documents');

      const { data: department } = await supabase
        .from('departments' as never)
        .select('id' as never)
        .eq('module' as never, module as never)
        .maybeSingle();

      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `departments/${module}/forms/${formTemplateId}/${timestamp}_${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });

      if (uploadError) throw uploadError;

      const insertPayload = {
        file_name: file.name,
        file_path: filePath,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        category,
        ngo_id: null,
        work_item_id: null,
        form_template_id: formTemplateId,
        module,
        department_id: (department as { id?: string } | null)?.id || null,
        uploaded_by_user_id: user.id,
        review_status: reviewStatus ?? 'Department Form Attachment',
      };

      const { data, error: dbError } = await supabase
        .from('documents')
        .insert(insertPayload as never)
        .select()
        .single();

      if (dbError) {
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        throw dbError;
      }

      return data as Document;
    },
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      toast({
        title: 'Department form document uploaded',
        description: 'The file has been saved to this form and department.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error uploading department form document',
        description: error.message,
      });
    },
  });
};

export const useDocumentUrl = () => {
  const { toast } = useToast();

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    ensureSupabase();
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 3600);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error accessing document',
        description: error.message,
      });
      return null;
    }

    return data.signedUrl;
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    const url = await getSignedUrl(filePath);
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const previewDocument = async (filePath: string) => {
    const url = await getSignedUrl(filePath);
    if (!url) return;
    window.open(url, '_blank');
  };

  return { getSignedUrl, downloadDocument, previewDocument };
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (document: Document) => {
      ensureSupabase();

      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

      // Remove the database record first. If object cleanup is temporarily
      // unavailable, the user-facing deletion still succeeds and leaves only
      // an inaccessible storage orphan that can be cleaned by maintenance.
      // Doing this in the opposite order can permanently break an otherwise
      // valid document when an RLS-protected database delete is rejected.
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([document.file_path]);

      if (storageError) {
        console.warn('Document row deleted; storage cleanup is pending', storageError);
      }
    },
    onSuccess: () => {
      invalidateDocumentQueries(queryClient);
      toast({
        title: 'Document deleted',
        description: 'The document has been successfully deleted.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error deleting document',
        description: error.message,
      });
    },
  });
};
