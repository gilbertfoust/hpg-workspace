import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useForm990(ngoId?: string | null, returnId?: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["form-990", ngoId] });
  const returns = useQuery({
    queryKey: ["form-990", ngoId, "returns"], enabled: Boolean(ngoId),
    queryFn: async () => { const { data, error } = await (supabase as any).from("tax_form_990_returns").select("*").eq("ngo_id", ngoId).order("tax_year", { ascending: false }); if (error) throw error; return data ?? []; },
  });
  const sections = useQuery({
    queryKey: ["form-990", ngoId, "sections", returnId], enabled: Boolean(returnId),
    queryFn: async () => { const { data, error } = await (supabase as any).from("tax_form_990_sections").select("*").eq("return_id", returnId).order("created_at"); if (error) throw error; return data ?? []; },
  });
  const create = useMutation({
    mutationFn: async (input: any) => { const { data, error } = await (supabase as any).rpc("create_form_990_return", { p_ngo_id: ngoId, p_tax_year: Number(input.taxYear), p_gross_receipts: Number(input.grossReceipts), p_assets_end_of_year: Number(input.assets), p_legal_name: input.legalName, p_ein: input.ein, p_force_full_990: input.forceFull, p_990n_ineligible: input.ineligible990n }); if (error) throw error; return data; },
    onSuccess: () => { invalidate(); toast.success("Form 990 workspace created"); }, onError: (error: Error) => toast.error(error.message),
  });
  const saveSection = useMutation({
    mutationFn: async ({ sectionKey, data, completed }: { sectionKey: string; data: any; completed: boolean }) => { const { data: result, error } = await (supabase as any).rpc("save_form_990_section", { p_return_id: returnId, p_section_key: sectionKey, p_data: data, p_completed: completed }); if (error) throw error; return result; },
    onSuccess: invalidate, onError: (error: Error) => toast.error(error.message),
  });
  const validate = useMutation({
    mutationFn: async () => { const { data, error } = await (supabase as any).rpc("validate_form_990_return", { p_return_id: returnId }); if (error) throw error; return data; },
    onSuccess: (data) => { invalidate(); data?.passed ? toast.success("Form 990 validation passed") : toast.error(`${data?.errors || 0} validation errors remain`); }, onError: (error: Error) => toast.error(error.message),
  });
  const prepare = useMutation({
    mutationFn: async () => { const { data, error } = await (supabase as any).rpc("prepare_form_990_filing", { p_return_id: returnId }); if (error) throw error; return data; },
    onSuccess: invalidate, onError: (error: Error) => toast.error(error.message),
  });
  return { returns, sections, create, saveSection, validate, prepare };
}
