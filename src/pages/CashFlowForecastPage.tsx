import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNGOs } from "@/hooks/useNGOs";
import { useCashFlowForecasts, useCashFlowForecastLines } from "@/hooks/useCashFlowForecasts";
import { format, addMonths } from "date-fns";

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function CashFlowForecastPage() {
  const { forecastId } = useParams<{ forecastId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const [newName, setNewName] = useState("");
  const [newMonths, setNewMonths] = useState(6);

  const { data: forecasts, create: createForecast } = useCashFlowForecasts(selectedNgoId || undefined);
  const { data: lines, upsertLines } = useCashFlowForecastLines(forecastId || undefined);
  const currentForecast = forecasts?.find(f => f.id === forecastId);

  const monthCount = currentForecast?.month_count || 6;
  const startMonth = currentForecast?.start_month ? new Date(currentForecast.start_month) : new Date();

  const monthHeaders = useMemo(() => {
    return Array.from({ length: monthCount }, (_, i) => format(addMonths(startMonth, i), "MMM yyyy"));
  }, [monthCount, startMonth]);

  // Group lines by category and type
  const receipts = useMemo(() => {
    const cats = new Map<string, Map<number, number>>();
    (lines || []).filter(l => l.line_type === "receipt").forEach(l => {
      if (!cats.has(l.category_label)) cats.set(l.category_label, new Map());
      cats.get(l.category_label)!.set(l.month_index, l.amount);
    });
    return cats;
  }, [lines]);

  const payments = useMemo(() => {
    const cats = new Map<string, Map<number, number>>();
    (lines || []).filter(l => l.line_type === "payment").forEach(l => {
      if (!cats.has(l.category_label)) cats.set(l.category_label, new Map());
      cats.get(l.category_label)!.set(l.month_index, l.amount);
    });
    return cats;
  }, [lines]);

  const handleCreateForecast = async () => {
    if (!selectedNgoId || !newName) return;
    try {
      const result = await createForecast.mutateAsync({
        ngo_id: selectedNgoId,
        name: newName,
        start_month: format(new Date(), "yyyy-MM-01"),
        month_count: newMonths,
        status: "draft",
      });
      navigate(`/financial-hub/cash-flow-forecast/${result.id}`);
      toast({ title: "Forecast created" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  if (!forecastId) {
    return (
      <MainLayout title="Cash Flow Forecast" subtitle="Monthly cash position projections">
        <div className="space-y-6 max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <Label>NGO</Label>
                  <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Forecast Name</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="FY2026 Forecast" />
                </div>
                <div>
                  <Label>Months</Label>
                  <Select value={String(newMonths)} onValueChange={v => setNewMonths(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">12 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateForecast} disabled={!selectedNgoId || !newName}>
                  <Plus className="w-4 h-4 mr-1" /> Create Forecast
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Saved Forecasts</CardTitle></CardHeader>
            <CardContent>
              {(!forecasts || forecasts.length === 0) ? (
                <p className="text-center text-muted-foreground py-6">No forecasts yet. Select an NGO and create one.</p>
              ) : (
                <div className="space-y-2">
                  {forecasts.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                         onClick={() => navigate(`/financial-hub/cash-flow-forecast/${f.id}`)}>
                      <div>
                        <p className="font-medium">{f.name}</p>
                        <p className="text-sm text-muted-foreground">{f.month_count} months from {format(new Date(f.start_month), "MMM yyyy")}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{f.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Forecast detail view
  const totalReceipts = (mi: number) => {
    let t = 0;
    receipts.forEach(months => t += months.get(mi) || 0);
    return t;
  };
  const totalPayments = (mi: number) => {
    let t = 0;
    payments.forEach(months => t += months.get(mi) || 0);
    return t;
  };

  return (
    <MainLayout title={currentForecast?.name || "Forecast Detail"} subtitle="Monthly cash flow projection">
      <div className="space-y-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Category</TableHead>
                  {monthHeaders.map((h, i) => (
                    <TableHead key={i} className="text-right min-w-[120px]">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-bold" colSpan={monthCount + 1}>Cash Receipts</TableCell>
                </TableRow>
                {Array.from(receipts.entries()).map(([cat, months]) => (
                  <TableRow key={cat}>
                    <TableCell className="pl-8">{cat}</TableCell>
                    {Array.from({ length: monthCount }, (_, i) => (
                      <TableCell key={i} className="text-right">{fmt(months.get(i) || 0)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total Receipts</TableCell>
                  {Array.from({ length: monthCount }, (_, i) => (
                    <TableCell key={i} className="text-right">{fmt(totalReceipts(i))}</TableCell>
                  ))}
                </TableRow>

                <TableRow className="bg-muted/30">
                  <TableCell className="font-bold" colSpan={monthCount + 1}>Cash Payments</TableCell>
                </TableRow>
                {Array.from(payments.entries()).map(([cat, months]) => (
                  <TableRow key={cat}>
                    <TableCell className="pl-8">{cat}</TableCell>
                    {Array.from({ length: monthCount }, (_, i) => (
                      <TableCell key={i} className="text-right">{fmt(months.get(i) || 0)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total Payments</TableCell>
                  {Array.from({ length: monthCount }, (_, i) => (
                    <TableCell key={i} className="text-right">{fmt(totalPayments(i))}</TableCell>
                  ))}
                </TableRow>

                <TableRow className="font-bold bg-muted/50">
                  <TableCell>Net Cash Change</TableCell>
                  {Array.from({ length: monthCount }, (_, i) => {
                    const net = totalReceipts(i) - totalPayments(i);
                    return <TableCell key={i} className={`text-right ${net < 0 ? "text-destructive" : ""}`}>{fmt(net)}</TableCell>;
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {receipts.size === 0 && payments.size === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No forecast lines yet. Add receipt and payment categories to build the projection.
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
