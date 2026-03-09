import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useNGOs } from "@/hooks/useNGOs";
import { Download, FileSpreadsheet, Users } from "lucide-react";
import { toast } from "sonner";

export default function PayrollExport() {
  const { data: staff } = useStaffProfiles({ status: "active" });
  const { data: timesheets } = useTimesheets({ status: "approved" });
  const { data: ngos } = useNGOs();
  const [ngoFilter, setNgoFilter] = useState<string>("all");

  const filteredStaff = (staff ?? []).filter(s =>
    ngoFilter === "all" || s.ngo_id === ngoFilter
  );

  const getApprovedHours = (staffId: string) => {
    return (timesheets ?? [])
      .filter(t => t.staff_id === staffId)
      .reduce((sum, t) => sum + (t.total_hours || 0), 0);
  };

  const handleExport = () => {
    const rows = filteredStaff.map(s => ({
      name: `${s.first_name} ${s.last_name}`,
      email: s.email || "",
      employment_type: s.employment_type,
      job_title: s.job_title || "",
      annual_salary: s.annual_salary || 0,
      hourly_rate: s.hourly_rate || 0,
      approved_hours: getApprovedHours(s.id),
      ngo: (s as any).ngos?.common_name || (s as any).ngos?.legal_name || "",
    }));

    const csv = [
      "Name,Email,Type,Title,Annual Salary,Hourly Rate,Approved Hours,NGO",
      ...rows.map(r => `"${r.name}","${r.email}","${r.employment_type}","${r.job_title}",${r.annual_salary},${r.hourly_rate},${r.approved_hours},"${r.ngo}"`)
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Payroll export downloaded");
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileSpreadsheet className="h-6 w-6" />Payroll Export</h1>
            <p className="text-muted-foreground">Generate payroll files for external processing</p>
          </div>
          <div className="flex gap-3">
            <Select value={ngoFilter} onValueChange={setNgoFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All NGOs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All NGOs</SelectItem>
                {ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleExport} disabled={!filteredStaff.length}>
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />Active Staff</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{filteredStaff.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Approved Timesheets</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{timesheets?.length ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Hours</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{(timesheets ?? []).reduce((s, t) => s + (t.total_hours || 0), 0)}h</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Approved Hours</TableHead>
                  <TableHead>NGO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filteredStaff.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No active staff</TableCell></TableRow>
                ) : filteredStaff.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                    <TableCell><Badge variant="outline">{s.employment_type.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-sm">{s.job_title || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{s.annual_salary ? `$${Number(s.annual_salary).toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{s.hourly_rate ? `$${Number(s.hourly_rate).toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{getApprovedHours(s.id)}h</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(s as any).ngos?.common_name || (s as any).ngos?.legal_name || "—"}</TableCell>
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
