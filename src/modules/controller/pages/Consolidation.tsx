import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNGOs } from "@/hooks/useNGOs";
import { useTrialBalance } from "@/hooks/useTrialBalance";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Layers } from "lucide-react";

export default function Consolidation() {
  const { data: ngos } = useNGOs();
  const { data: periods } = useFiscalPeriods();
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="h-6 w-6" />Financial Consolidation</h1>
            <p className="text-muted-foreground">Aggregate financial data across all NGOs</p>
          </div>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Period" /></SelectTrigger>
            <SelectContent>{periods?.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total NGOs</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{ngos?.length ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Fiscal Periods</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{periods?.length ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
            <CardContent><Badge variant="outline">{selectedPeriod ? "Period Selected" : "Select a Period"}</Badge></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>NGO Summary</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NGO</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Country</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!ngos?.length ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No NGOs</TableCell></TableRow>
                ) : ngos.map(n => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.common_name || n.legal_name}</TableCell>
                    <TableCell><Badge variant={n.status === "active" ? "default" : "secondary"}>{n.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{n.country || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
