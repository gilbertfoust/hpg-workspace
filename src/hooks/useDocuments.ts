import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
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

export const useDocuments = (filters?: { ngo_id?: string; work_item_id?: string; category?: DocumentCategory }) => {
  return useQuery({
    queryKey: ['documents', filters],
    queryFn: async () => {
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
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
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
