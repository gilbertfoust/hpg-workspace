import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { LedgerTable } from "@/components/finance/LedgerTable";
import { AccountSelector } from "@/components/finance/AccountSelector";
import { useAccounts } from "@/hooks/useAccounts";
import { useLedger } from "@/hooks/useLedger";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GeneralLedgerPage = () => {
  const [ngoId, setNgoId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
  const selectedAccount = accounts?.find((a) => a.id === accountId);
  const { data: entries, isLoading } = useLedger(activeNgoId, accountId || undefined, startDate || undefined, endDate || undefined);

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">General Ledger</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>NGO</Label>
            <Select value={ngoId} onValueChange={(v) => { setNgoId(v); setAccountId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
              <SelectContent>
                {(ngos || []).map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Account</Label>
            {accounts ? (
              <AccountSelector accounts={accounts} value={accountId} onValueChange={setAccountId} placeholder="Select account" />
            ) : (
              <div className="text-sm text-muted-foreground py-2">Select an NGO first</div>
            )}
          </div>
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {accountId ? (
          <LedgerTable entries={entries || []} isLoading={isLoading} accountType={selectedAccount?.type} />
        ) : (
          <div className="text-center text-muted-foreground py-8">Select an NGO and account to view the ledger.</div>
        )}
      </div>
    </MainLayout>
  );
};

export default GeneralLedgerPage;
