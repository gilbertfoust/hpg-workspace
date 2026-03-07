// src/pages/Dashboard.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  FileText,
  Calendar as CalendarIcon,
  ArrowRight,
  Users,
  AlertCircle,
  Clock,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useNGOStats } from "@/hooks/useNGOs";
import { Loader2 } from "lucide-react";

const HPG_LOGO_URL =
  "https://img1.wsimg.com/isteam/ip/8d5502d6-d937-4d80-bd56-8074053e4d77/Humanity%20Pathways%20Global.jpg/:/rs=h:175,m";

const DashboardMetrics = () => {
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboardData({});
  const { data: ngoStats, isLoading: ngoStatsLoading } = useNGOStats();

  if (dashboardLoading || ngoStatsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metrics</CardTitle>
          <CardDescription>Loading dashboard data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeNgoCount = ngoStats?.active || 0;
  const missingEvidenceCount = dashboardData?.evidencePending?.length || 0;
  const overdueCount = dashboardData?.kpis?.overdue || 0;
  const dueIn7Days = dashboardData?.kpis?.dueIn7Days || 0;
  const workloadByDept = dashboardData?.workloadByDepartment || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metrics</CardTitle>
        <CardDescription>
          Overview of active NGOs, work items, and compliance status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="w-4 h-4" />
              Active NGOs
            </div>
            <p className="text-2xl font-bold">{activeNgoCount}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 text-destructive" />
              Missing Evidence
            </div>
            <p className="text-2xl font-bold text-destructive">{missingEvidenceCount}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-orange-500" />
              Overdue Items
            </div>
            <p className="text-2xl font-bold text-orange-500">{overdueCount}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="w-4 h-4 text-blue-500" />
              Due in 7 Days
            </div>
            <p className="text-2xl font-bold text-blue-500">{dueIn7Days}</p>
          </div>
        </div>

        {/* Work Items by Department */}
        {workloadByDept.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Open Work Items by Department</h4>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {workloadByDept.map(({ department, count }) => (
                <div key={department} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm font-medium">{department}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Evidence Items */}
        {missingEvidenceCount > 0 && dashboardData?.evidencePending && dashboardData.evidencePending.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Items Missing Evidence</h4>
            <div className="space-y-2">
              {dashboardData.evidencePending.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div>
                    <p className="font-medium">{item.ngoName}</p>
                    <p className="text-xs text-muted-foreground">{item.department}</p>
                  </div>
                  {item.dueDate && (
                    <Badge variant="outline" className="text-xs">
                      {new Date(item.dueDate).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              ))}
              {missingEvidenceCount > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{missingEvidenceCount - 10} more items missing evidence
                </p>
              )}
            </div>
          </div>
        )}

        {/* At-Risk NGOs */}
        {dashboardData?.atRiskNgos && dashboardData.atRiskNgos.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">At-Risk NGOs</h4>
            <div className="space-y-2">
              {dashboardData.atRiskNgos.slice(0, 10).map((ngo) => (
                <div key={ngo.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div>
                    <p className="font-medium">{ngo.name}</p>
                    <p className="text-xs text-muted-foreground">{ngo.location}</p>
                  </div>
                  {ngo.bundle && (
                    <Badge variant="outline" className="text-xs">
                      {ngo.bundle}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-md border bg-background/60">
              {logoFailed ? (
                <LayoutDashboard className="w-5 h-5 text-primary" />
              ) : (
                <img
                  src={HPG_LOGO_URL}
                  alt="Humanity Pathways Global"
                  className="h-full w-full object-contain p-0.5"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </span>
            HPG Workspace
          </h1>
          <p className="text-muted-foreground">
            Overview of NGOs, work items, forms, and evidence across Humanity Pathways Global.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/ngos")}>
            <Users className="w-4 h-4 mr-2" />
            View NGOs
          </Button>
          <Button onClick={() => navigate("/work-items")}>
            Open Work Queue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Quick navigation cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card
          className="cursor-pointer hover:border-primary/60 transition-colors"
          onClick={() => navigate("/ngos")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              NGOs
            </CardTitle>
            <CardDescription>Browse sponsored NGOs and open their 360° view.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Use this space to manage onboarding status, contacts, and compliance for each NGO.
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/60 transition-colors"
          onClick={() => navigate("/work-items")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              Work Items
            </CardTitle>
            <CardDescription>Track tasks, follow-ups, and reviews.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Coordinators and department leads use this list to move cases from intake to completion.
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/60 transition-colors"
          onClick={() => navigate("/forms")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Forms
            </CardTitle>
            <CardDescription>Dynamic templates for check-ins and requests.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Launch monthly check-ins, document requests, and other structured workflows tied to NGOs.
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/60 transition-colors"
          onClick={() => navigate("/calendar")}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              Calendar
            </CardTitle>
            <CardDescription>Time-based view of activities and deadlines.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This view could later align program activities, reporting cycles, and compliance dates.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Metrics */}
      <DashboardMetrics />
    </div>
  );
};

export default Dashboard;
