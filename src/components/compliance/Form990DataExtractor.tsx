import { useTrialBalance } from "@/hooks/useTrialBalance";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Form990Data {
  revenue: { label: string; amount: number }[];
  totalRevenue: number;
  expenses: { label: string; amount: number }[];
  totalExpenses: number;
  netAssets: number;
  governance: { name: string; title: string; email: string }[];
  foreignActivity: { country: string; region: string };
}

export function useForm990Data(ngoId?: string, fiscalYear?: number): { data: Form990Data | null; isLoading: boolean } {
  const { data: trialBalance, isLoading: tbLoading } = useTrialBalance(ngoId);

  const { data: ngo, isLoading: ngoLoading } = useQuery({
    queryKey: ["ngo_990", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("ngos").select("*").eq("id", ngoId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts_990", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("ngo_id", ngoId!);
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = tbLoading || ngoLoading || contactsLoading;

  if (isLoading || !trialBalance) return { data: null, isLoading };

  const incomeRows = trialBalance.filter((r) => r.account_type === "income");
  const expenseRows = trialBalance.filter((r) => r.account_type === "expense");

  const revenue = incomeRows.map((r) => ({ label: `${r.account_code} — ${r.account_name}`, amount: r.total_credit - r.total_debit }));
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);

  const expenses = expenseRows.map((r) => ({ label: `${r.account_code} — ${r.account_name}`, amount: r.total_debit - r.total_credit }));
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);

  const governance = (contacts || []).map((c: any) => ({
    name: c.name,
    title: c.title || "Board Member",
    email: c.email || "",
  }));

  return {
    data: {
      revenue,
      totalRevenue,
      expenses,
      totalExpenses,
      netAssets: totalRevenue - totalExpenses,
      governance,
      foreignActivity: { country: ngo?.country || "N/A", region: ngo?.region || "N/A" },
    },
    isLoading: false,
  };
}
