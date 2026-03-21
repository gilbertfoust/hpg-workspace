import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Download } from "lucide-react";
import { useNGOs } from "@/hooks/useNGOs";
import { useBills } from "@/hooks/useBills";
import { differenceInDays } from "date-fns";

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

interface AgingBucket {
  vendor: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

export default function AgedPayablesPage() {
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const { data: bills } = useBills(selectedNgoId || undefined);

  const openBills = bills?.filter(b => b.status !== "paid" && b.status !== "void") || [];

  const buckets = useMemo(() => {
    const map: Record<string, AgingBucket> = {};
    const today = new Date();
    openBills.forEach(bill => {
      const age = differenceInDays(today, new Date(bill.due_date));
      if (!map[bill.vendor_name]) {
        map[bill.vendor_name] = { vendor: bill.vendor_name, current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
      }
      const b = map[bill.vendor_name];
      const amt = Number(bill.total);
      if (age <= 0) b.current += amt;
      else if (age <= 30) b.days30 += amt;
      else if (age <= 60) b.days60 += amt;
      else if (age <= 90) b.days90 += amt;
      else b.over90 += amt;
      b.total += amt;
    });
    return Object.values(map);
  }, [openBills]);

  const totals = useMemo(() => buckets.reduce((t, b) => ({
    current: t.current + b.current, days30: t.days30 + b.days30, days60: t.days60 + b.days60,
    days90: t.days90 + b.days90, over90: t.over90 + b.over90, total: t.total + b.total,
  }), { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 }), [buckets]);

  const exportCSV = () => {
    const header = "Vendor,Current,1-30 Days,31-60 Days,61-90 Days,90+ Days,Total\n";
    const rows = buckets.map(b => `"${b.vendor}",${b.current},${b.days30},${b.days60},${b.days90},${b.over90},${b.total}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "aged-payables.csv"; a.click();
  };

  return (
    <MainLayout title="Aged Payables" subtitle="Outstanding bill aging by vendor">
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-end gap-4">
          <div className="w-64">
            <Label>NGO</Label>
            <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
              <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
              <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {buckets.length > 0 && (
            <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Current</p><p className="text-lg font-bold">${fmt(totals.current)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">1-30 Days</p><p className="text-lg font-bold">${fmt(totals.days30)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">31-60 Days</p><p className="text-lg font-bold">${fmt(totals.days60)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">61-90 Days</p><p className="text-lg font-bold">${fmt(totals.days90)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">90+ Days</p><p className="text-lg font-bold text-destructive">${fmt(totals.over90)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Payable</p><p className="text-lg font-bold">${fmt(totals.total)}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Aging Detail</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">1-30 Days</TableHead>
                  <TableHead className="text-right">31-60 Days</TableHead>
                  <TableHead className="text-right">61-90 Days</TableHead>
                  <TableHead className="text-right">90+ Days</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.map(b => (
                  <TableRow key={b.vendor}>
                    <TableCell className="font-medium">{b.vendor}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(b.current)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(b.days30)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(b.days60)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(b.days90)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(b.over90)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(b.total)}</TableCell>
                  </TableRow>
                ))}
                {buckets.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No outstanding bills</TableCell></TableRow>
                )}
              </TableBody>
              {buckets.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(totals.current)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(totals.days30)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(totals.days60)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(totals.days90)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(totals.over90)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmt(totals.total)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
