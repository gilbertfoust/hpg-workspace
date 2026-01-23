// src/pages/Dashboard.tsx
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  FileText,
  Calendar as CalendarIcon,
  ArrowRight,
  Users,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
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

      {/* Placeholder for future metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
          <CardDescription>
            Space reserved for program, development, and compliance metrics once the data flows are stable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Once the PRs for documents, forms, and NGO 360 are merged cleanly, this dashboard will show summaries like
            active NGOs, open work items by department, missing evidence, and upcoming reporting dates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
