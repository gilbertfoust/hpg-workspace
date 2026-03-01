import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { YearEndCloseWizard } from "@/components/compliance/YearEndCloseWizard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight } from "lucide-react";

const CloseYearPage = () => {
  const { data: ngos } = useQuery({
    queryKey: ["ngos_close"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ngos").select("id, legal_name, common_name").order("common_name");
      if (error) throw error;
      return data || [];
    },
  });

  const [selectedNgo, setSelectedNgo] = useState("");
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/financial-hub" className="hover:text-foreground">Financial Hub</Link>
          <ChevronRight className="h-4 w-4" />
          <Link to="/financial-hub/compliance" className="hover:text-foreground">Compliance</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Close Year</span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Year-End Close</h1>
          <div className="flex gap-2">
            <Select value={selectedNgo} onValueChange={setSelectedNgo}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Select NGO" /></SelectTrigger>
              <SelectContent>
                {(ngos || []).map((n) => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {selectedNgo ? (
          <YearEndCloseWizard ngoId={selectedNgo} fiscalYear={fiscalYear} />
        ) : (
          <p className="text-muted-foreground">Select an NGO to begin year-end close.</p>
        )}
      </div>
    </MainLayout>
  );
};

export default CloseYearPage;
