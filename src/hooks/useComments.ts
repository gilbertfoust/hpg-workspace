import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
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

export const useComments = (work_item_id: string) => {
  return useQuery({
    queryKey: ['comments', work_item_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('work_item_id', work_item_id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      const authorIds = [...new Set((data || []).map((comment) => comment.author_user_id))];

      if (authorIds.length === 0) {
        return data as Comment[];
      }

      const { data: authors, error: authorError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', authorIds);

      if (authorError) throw authorError;

      const authorMap = new Map(
        (authors || []).map((author) => [
          author.id,
          { full_name: author.full_name, email: author.email, avatar_url: author.avatar_url },
        ])
      );

      return (data || []).map((comment) => ({
        ...comment,
        author: authorMap.get(comment.author_user_id),
      })) as Comment[];
    },
    enabled: !!work_item_id,
  });
};

export const useCommentsForNGO = (ngo_id: string) => {
  return useQuery({
    queryKey: ['comments', 'ngo', ngo_id],
    queryFn: async () => {
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
        .select('*')
        .in('work_item_id', workItemIds)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      const authorIds = [...new Set((data || []).map((comment) => comment.author_user_id))];

      if (authorIds.length === 0) {
        return data as Comment[];
      }

      const { data: authors, error: authorError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', authorIds);

      if (authorError) throw authorError;

      const authorMap = new Map(
        (authors || []).map((author) => [
          author.id,
          { full_name: author.full_name, email: author.email, avatar_url: author.avatar_url },
        ])
      );

      return (data || []).map((comment) => ({
        ...comment,
        author: authorMap.get(comment.author_user_id),
      })) as Comment[];
    },
    enabled: !!ngo_id,
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
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
