import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { useTimesheets } from "@/hooks/useTimesheets";
import { usePTORequests } from "@/hooks/usePTORequests";
import { Users, Clock, CalendarDays, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function HRModuleDashboard() {
  const navigate = useNavigate();
  const { data: staff } = useStaffProfiles();
  const { data: timesheets } = useTimesheets();
  const { data: ptoRequests } = usePTORequests();

  const activeStaff = staff?.filter(s => s.status === "active").length ?? 0;
  const pendingTimesheets = timesheets?.filter(t => t.status === "submitted").length ?? 0;
  const pendingPTO = ptoRequests?.filter(p => p.status === "pending").length ?? 0;
  const onLeave = staff?.filter(s => s.status === "on_leave").length ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">HR & Workforce</h1>
          <p className="text-muted-foreground">Staff management, timesheets, and PTO tracking</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/erp/hr/staff")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{activeStaff}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/erp/hr/timesheets")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Timesheets</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{pendingTimesheets}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/erp/hr/pto")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending PTO</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{pendingPTO}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">On Leave</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{onLeave}</p></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Staff</CardTitle></CardHeader>
            <CardContent>
              {staff?.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-muted-foreground">{s.job_title || s.employment_type.replace(/_/g, " ")}</p>
                  </div>
                  <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                </div>
              )) ?? <p className="text-sm text-muted-foreground">No staff yet</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent PTO Requests</CardTitle></CardHeader>
            <CardContent>
              {ptoRequests?.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{(p as any).staff_profiles?.first_name} {(p as any).staff_profiles?.last_name}</p>
                    <p className="text-xs text-muted-foreground">{p.leave_type} · {p.hours_requested}h</p>
                  </div>
                  <Badge variant={p.status === "pending" ? "outline" : p.status === "approved" ? "default" : "secondary"}>{p.status}</Badge>
                </div>
              )) ?? <p className="text-sm text-muted-foreground">No requests yet</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
