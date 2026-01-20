import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Comment {
  id: string;
  work_item_id: string;
  author_user_id: string;
  comment_text: string;
  created_at: string;
  author?: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export interface CreateCommentInput {
  work_item_id: string;
  author_user_id: string;
  comment_text: string;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useComments = (work_item_id: string) => {
  return useQuery({
    queryKey: ['comments', work_item_id],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles!comments_author_user_id_fkey(full_name, email, avatar_url)
        `)
        .eq('work_item_id', work_item_id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Comment[];
    },
    enabled: !!work_item_id,
  });
};

export const useCommentsForNGO = (ngo_id: string) => {
  return useQuery({
    queryKey: ['comments', 'ngo', ngo_id],
    queryFn: async () => {
      ensureSupabase();
      // First get all work items for this NGO
      const { data: workItems, error: wiError } = await supabase
        .from('work_items')
        .select('id')
        .eq('ngo_id', ngo_id);
      
      if (wiError) throw wiError;
      
      if (!workItems || workItems.length === 0) return [];
      
      const workItemIds = workItems.map(wi => wi.id);
      
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles!comments_author_user_id_fkey(full_name, email, avatar_url)
        `)
        .in('work_item_id', workItemIds)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Comment[];
    },
    enabled: !!ngo_id,
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('comments')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data as Comment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comments', data.work_item_id] });
      queryClient.invalidateQueries({ queryKey: ['comments', 'ngo'] });
      toast({
        title: 'Comment added',
        description: 'Your comment has been added.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error adding comment',
        description: error.message,
      });
    },
  });
};
