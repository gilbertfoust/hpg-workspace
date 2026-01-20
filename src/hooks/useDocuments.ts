import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

export type DocumentCategory = Database['public']['Enums']['document_category'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type CreateDocumentInput = Database['public']['Tables']['documents']['Insert'];

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
    mutationFn: async ({ id, ...input }: Database['public']['Tables']['documents']['Update'] & { id: string }) => {
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
