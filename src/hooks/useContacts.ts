import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type OrgType = 'ngo' | 'partner' | 'funder' | 'vendor' | 'applicant';

export interface Contact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  ngo_id: string | null;
  user_id: string | null;
  is_primary: boolean;
  org_type: OrgType;
  created_at: string;
  updated_at: string;
}

export interface CreateContactInput {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  location?: string;
  ngo_id?: string;
  is_primary?: boolean;
  org_type?: OrgType;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useContacts = (ngo_id?: string) => {
  return useQuery({
    queryKey: ['contacts', ngo_id],
    queryFn: async () => {
      ensureSupabase();
      let query = supabase.from('contacts').select('*');
      
      if (ngo_id) {
        query = query.eq('ngo_id', ngo_id);
      }
      
      const { data, error } = await query.order('is_primary', { ascending: false });
      
      if (error) throw error;
      return data as Contact[];
    },
  });
};

export const useContact = (id: string) => {
  return useQuery({
    queryKey: ['contacts', 'detail', id],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Contact;
    },
    enabled: !!id,
  });
};

export const useCreateContact = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateContactInput) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('contacts')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      if (data.ngo_id) {
        queryClient.invalidateQueries({ queryKey: ['contacts', data.ngo_id] });
      }
      toast({
        title: 'Contact created',
        description: 'The contact has been successfully created.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error creating contact',
        description: error.message,
      });
    },
  });
};

export const useUpdateContact = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Contact> & { id: string }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('contacts')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      if (data.ngo_id) {
        queryClient.invalidateQueries({ queryKey: ['contacts', data.ngo_id] });
      }
      toast({
        title: 'Contact updated',
        description: 'The contact has been successfully updated.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error updating contact',
        description: error.message,
      });
    },
  });
};
