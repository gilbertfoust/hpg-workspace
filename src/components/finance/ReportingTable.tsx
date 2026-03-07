import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ReportingTableProps {
  onRowClick: (ngoId: string) => void;
}

const REVIEW_STATUSES = ["all", "not_started", "awaiting_ngo", "under_review", "approved", "needs_revision"];
const PERIOD_TYPES = ["all", "monthly", "quarterly", "annual"];

export function ReportingTable({ onRowClick }: ReportingTableProps) {
  const [searchNgo, setSearchNgo] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPeriodType, setFilterPeriodType] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");

  const { data: ngos, isLoading: ngosLoading } = useQuery({
    queryKey: ["ngos_finance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ngos").select("id, legal_name, common_name, country, region");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: periods, isLoading: periodsLoading } = useQuery({
    queryKey: ["fiscal_periods_all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("fiscal_periods").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["financial_review_status_all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("financial_review_status").select("*");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: actuals } = useQuery({
    queryKey: ["actuals_summary"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("actuals").select("ngo_id, fiscal_period_id, category_id, amount");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["budget_categories_types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("budget_categories").select("id, type");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const regions = useMemo(() => {
    if (!ngos) return [];
    return [...new Set(ngos.map((n: any) => n.region).filter(Boolean))].sort() as string[];
  }, [ngos]);

  const rows = useMemo(() => {
    if (!ngos || !periods) return [];
    const catTypeMap = new Map((categories || []).map((c: any) => [c.id, c.type]));

    return ngos.map((ngo: any) => {
      const ngoPeriods = (periods || []).filter((p: any) => p.ngo_id === ngo.id);
      const latestPeriod = ngoPeriods[0];
      const review = latestPeriod ? (reviews || []).find((r: any) => r.ngo_id === ngo.id && r.fiscal_period_id === latestPeriod.id) : null;

      let totalIncome = 0;
      let totalExpense = 0;
      if (latestPeriod) {
        (actuals || []).filter((a: any) => a.ngo_id === ngo.id && a.fiscal_period_id === latestPeriod.id).forEach((a: any) => {
          const type = catTypeMap.get(a.category_id);
          if (type === "income") totalIncome += Number(a.amount);
          else if (type === "expense") totalExpense += Number(a.amount);
        });
      }

      return {
        id: ngo.id,
        name: ngo.common_name || ngo.legal_name,
        region: ngo.region,
        latestPeriod: latestPeriod?.label || null,
        latestPeriodType: latestPeriod?.period_type || null,
        reviewStatus: review?.status || (latestPeriod ? "not_started" : null),
        totalIncome,
        totalExpense,
      };
    });
  }, [ngos, periods, reviews, actuals, categories]);

  const filtered = useMemo(() => {
    return rows.filter((r: any) => {
      if (searchNgo && !r.name.toLowerCase().includes(searchNgo.toLowerCase())) return false;
      if (filterStatus !== "all" && r.reviewStatus !== filterStatus) return false;
      if (filterRegion !== "all" && r.region !== filterRegion) return false;
      if (filterPeriodType !== "all") {
        const hasPT = (periods || []).some((p: any) => p.ngo_id === r.id && p.period_type === filterPeriodType);
        if (!hasPT) return false;
      }
      return true;
    });
  }, [rows, searchNgo, filterStatus, filterRegion, filterPeriodType, periods]);

  const fmt = (val: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  if (ngosLoading || periodsLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search NGO..." className="w-60" value={searchNgo} onChange={(e) => setSearchNgo(e.target.value)} />
        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {REVIEW_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All Statuses" : s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPeriodType} onValueChange={setFilterPeriodType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Period Type" /></SelectTrigger>
          <SelectContent>
            {PERIOD_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t === "all" ? "All Types" : t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NGO</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Latest Period</TableHead>
              <TableHead>Review Status</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expense</TableHead>
              <TableHead className="text-right">Surplus / Deficit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No NGOs match the current filters.</TableCell></TableRow>
            ) : (
              filtered.map((row: any) => {
                const surplus = row.totalIncome - row.totalExpense;
                return (
                  <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(row.id)}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.region || "—"}</TableCell>
                    <TableCell>{row.latestPeriod || "—"}</TableCell>
                    <TableCell>
                      {row.reviewStatus ? (
                        <Badge variant="outline" className="capitalize">{row.reviewStatus.replace(/_/g, " ")}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{fmt(row.totalIncome)}</TableCell>
                    <TableCell className="text-right">{fmt(row.totalExpense)}</TableCell>
                    <TableCell className={`text-right font-medium ${surplus >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(surplus)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
