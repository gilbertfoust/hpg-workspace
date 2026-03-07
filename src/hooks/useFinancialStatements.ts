import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FinancialStatement {
  id: string;
  ngo_id: string;
  fiscal_year: number;
  statement_type: string;
  data_json: any;
  generated_by_user_id: string | null;
  created_at: string;
}

export function useFinancialStatements(ngoId?: string, fiscalYear?: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["financial_statements", ngoId, fiscalYear],
    enabled: !!ngoId,
    queryFn: async () => {
      let q = (supabase as any).from("financial_statements").select("*").eq("ngo_id", ngoId!).order("created_at", { ascending: false });
      if (fiscalYear) q = q.eq("fiscal_year", fiscalYear);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FinancialStatement[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (stmt: Omit<FinancialStatement, "id" | "created_at">) => {
      // Delete existing for same ngo/year/type, then insert
      await (supabase as any).from("financial_statements")
        .delete()
        .eq("ngo_id", stmt.ngo_id)
        .eq("fiscal_year", stmt.fiscal_year)
        .eq("statement_type", stmt.statement_type);

      const { data, error } = await (supabase as any).from("financial_statements").insert(stmt).select().single();
      if (error) throw error;
      return data as FinancialStatement;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["financial_statements"] }),
  });

  return { ...query, upsert };
}
