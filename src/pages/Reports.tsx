import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  FileText,
  Download,
  Calendar,
  Building2,
  Users,
  ClipboardList,
  ArrowRight,
} from "lucide-react";

const reportCategories = [
  {
    title: "Executive Reports",
    description: "High-level organizational metrics and KPIs",
    reports: [
      { name: "Monthly Executive Summary", icon: <BarChart3 className="w-4 h-4" /> },
      { name: "Quarterly Performance Review", icon: <TrendingUp className="w-4 h-4" /> },
      { name: "NGO Portfolio Health", icon: <PieChart className="w-4 h-4" /> },
    ],
  },
  {
    title: "NGO Reports",
    description: "Organization-specific metrics and status",
    reports: [
      { name: "NGO Status Summary", icon: <Building2 className="w-4 h-4" /> },
      { name: "Onboarding Progress Report", icon: <ClipboardList className="w-4 h-4" /> },
      { name: "At-Risk NGO Analysis", icon: <FileText className="w-4 h-4" /> },
    ],
  },
  {
    title: "Work Item Reports",
    description: "Task completion and workload analytics",
    reports: [
      { name: "Completion Rate by Department", icon: <BarChart3 className="w-4 h-4" /> },
      { name: "Overdue Items Report", icon: <Calendar className="w-4 h-4" /> },
      { name: "Evidence Compliance Report", icon: <FileText className="w-4 h-4" /> },
    ],
  },
  {
    title: "Team Reports",
    description: "Staff workload and performance metrics",
    reports: [
      { name: "Workload Distribution", icon: <Users className="w-4 h-4" /> },
      { name: "Approval Queue Analysis", icon: <ClipboardList className="w-4 h-4" /> },
      { name: "Response Time Metrics", icon: <TrendingUp className="w-4 h-4" /> },
    ],
  },
];

export default function Reports() {
  return (
    <MainLayout
      title="Reports"
      subtitle="Generate and download operational reports"
      actions={
        <Button variant="outline">
          <Calendar className="w-4 h-4 mr-2" />
          Schedule Report
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportCategories.map((category) => (
          <Card key={category.title}>
            <CardHeader>
              <CardTitle className="text-lg">{category.title}</CardTitle>
              <CardDescription>{category.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {category.reports.map((report) => (
                  <div
                    key={report.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {report.icon}
                      </div>
                      <span className="font-medium text-sm">{report.name}</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="w-4 h-4" />
                      </Button>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Reports */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Recent Reports</CardTitle>
          <CardDescription>Previously generated reports available for download</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Monthly Executive Summary - December 2025</p>
                  <p className="text-xs text-muted-foreground">Generated Jan 5, 2026</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">PDF</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">NGO Portfolio Health - Q4 2025</p>
                  <p className="text-xs text-muted-foreground">Generated Jan 2, 2026</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">XLSX</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
