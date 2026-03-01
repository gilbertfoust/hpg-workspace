import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { AccountsTable } from "@/components/finance/AccountsTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AccountsPage = () => {
  const [ngoId, setNgoId] = useState<string>("");

  const { data: ngos } = useQuery({
    queryKey: ["ngos_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ngos").select("id, common_name, legal_name").order("common_name");
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Chart of Accounts</h1>
          <Select value={ngoId} onValueChange={setNgoId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Filter by NGO (global)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All (Global)</SelectItem>
              {(ngos || []).map((n) => (
                <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AccountsTable ngoId={ngoId && ngoId !== "__all__" ? ngoId : undefined} />
      </div>
    </MainLayout>
  );
};

export default AccountsPage;
