import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type DocumentCategory = 
  | 'onboarding' | 'compliance' | 'finance' | 'hr' 
  | 'marketing' | 'communications' | 'program' 
  | 'curriculum' | 'it' | 'legal' | 'other';

export interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: DocumentCategory;
  ngo_id: string | null;
  work_item_id: string | null;
  uploaded_by_user_id: string | null;
  uploaded_at: string;
  review_status: string | null;
  review_notes: string | null;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentInput {
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  category?: DocumentCategory;
  ngo_id?: string;
  work_item_id?: string;
  uploaded_by_user_id?: string;
}

const BUCKET_NAME = 'ngo-documents';

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useDocuments = (filters?: { ngo_id?: string; work_item_id?: string; category?: DocumentCategory }) => {
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
      queryClient.invalidateQueries({ queryKey: ['documents'] });
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
      queryClient.invalidateQueries({ queryKey: ['documents'] });
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

// Upload a file to storage and create a document record
export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      file,
      ngoId,
      category,
      workItemId,
    }: {
      file: File;
      ngoId: string;
      category: DocumentCategory;
      workItemId?: string;
    }) => {
      ensureSupabase();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to upload documents');

      // Generate unique file path: ngo_id/timestamp_filename
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${ngoId}/${timestamp}_${sanitizedFileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create document record
      const { data, error: dbError } = await supabase
        .from('documents')
        .insert({
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          category,
          ngo_id: ngoId,
          work_item_id: workItemId || null,
          uploaded_by_user_id: user.id,
          review_status: 'pending',
        })
        .select()
        .single();

      if (dbError) {
        // Cleanup: delete uploaded file if database insert fails
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        throw dbError;
      }

      return data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
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

// Get a signed URL for downloading/previewing a document
export const useDocumentUrl = () => {
  const { toast } = useToast();

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    ensureSupabase();
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

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

    // Create a link and trigger download
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
    
    // Open in new tab
    window.open(url, '_blank');
  };

  return { getSignedUrl, downloadDocument, previewDocument };
};

// Delete a document from storage and database
export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (document: Document) => {
      ensureSupabase();

      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Delete database record
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
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
