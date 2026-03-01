import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PackageBuilder } from "@/components/compliance/PackageBuilder";
import { Form990Sections } from "@/components/compliance/Form990Sections";
import { NarrativeEditor } from "@/components/compliance/NarrativeEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight } from "lucide-react";

const PackagesPage = () => {
  const { data: ngos } = useQuery({
    queryKey: ["ngos_packages"],
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
          <span className="text-foreground">Packages</span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Compliance Packages</h1>
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
          <Tabs defaultValue="packages">
            <TabsList>
              <TabsTrigger value="packages">Packages</TabsTrigger>
              <TabsTrigger value="990">990 Preview</TabsTrigger>
              <TabsTrigger value="narrative">Narratives</TabsTrigger>
            </TabsList>
            <TabsContent value="packages" className="mt-4">
              <PackageBuilder ngoId={selectedNgo} fiscalYear={fiscalYear} />
            </TabsContent>
            <TabsContent value="990" className="mt-4">
              <Form990Sections ngoId={selectedNgo} fiscalYear={fiscalYear} />
            </TabsContent>
            <TabsContent value="narrative" className="mt-4">
              <NarrativeEditor initialData={{}} onSave={() => {}} />
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-muted-foreground">Select an NGO to manage packages.</p>
        )}
      </div>
    </MainLayout>
  );
};

export default PackagesPage;
