import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const NewTransactionPage = () => {
  const [ngoId, setNgoId] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: ngos } = useQuery({
    queryKey: ["ngos_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ngos").select("id, common_name, legal_name").order("common_name");
      if (error) throw error;
      return data || [];
    },
  });

  const activeNgoId = ngoId && ngoId !== "__all__" ? ngoId : undefined;
  const { data: accounts } = useAccounts(activeNgoId);
  const { create } = useTransactions(activeNgoId);

  const handleSubmit = async (data: { transaction_date: string; description: string; reference_number: string; entries: any[] }) => {
    if (!activeNgoId) {
      toast({ variant: "destructive", title: "Please select an NGO" });
      return;
    }
    try {
      await create.mutateAsync({
        transaction: {
          ngo_id: activeNgoId,
          fiscal_period_id: null,
          transaction_date: data.transaction_date,
          description: data.description,
          reference_number: data.reference_number || null,
          created_by_user_id: user?.id || null,
        },
        entries: data.entries,
      });
      toast({ title: "Transaction saved" });
      navigate("/financial-hub/transactions");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-6 max-w-4xl">
        <h1 className="text-2xl font-bold">New Transaction</h1>

        <div>
          <Select value={ngoId} onValueChange={setNgoId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select NGO *" /></SelectTrigger>
            <SelectContent>
              {(ngos || []).map((n) => (
                <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeNgoId && accounts ? (
          <TransactionForm accounts={accounts} onSubmit={handleSubmit} submitting={create.isPending} />
        ) : (
          <div className="text-muted-foreground py-8 text-center">Select an NGO to begin.</div>
        )}
      </div>
    </MainLayout>
  );
};

export default NewTransactionPage;
