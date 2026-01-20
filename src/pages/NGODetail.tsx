import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/common/StatusChip";
import { 
  ArrowLeft, 
  Edit, 
  MoreHorizontal,
  Building2,
  FileText,
  FolderOpen,
  Calendar,
  Activity,
  ListTodo
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useNGO } from "@/hooks/useNGOs";
import { NGOOverviewTab } from "@/components/ngo/NGOOverviewTab";
import { NGOWorkItemsTab } from "@/components/ngo/NGOWorkItemsTab";
import { NGOFormsTab } from "@/components/ngo/NGOFormsTab";
import { NGODocumentsTab } from "@/components/ngo/NGODocumentsTab";
import { NGOCalendarTab } from "@/components/ngo/NGOCalendarTab";
import { NGOActivityTab } from "@/components/ngo/NGOActivityTab";
import { NGOEditSheet } from "@/components/ngo/NGOEditSheet";

const statusMap: Record<string, "approved" | "in-progress" | "rejected" | "draft" | "waiting-ngo"> = {
  Active: "approved",
  Onboarding: "in-progress",
  "At-Risk": "rejected",
  Prospect: "draft",
  Offboarding: "waiting-ngo",
  Closed: "rejected",
};

export default function NGODetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ngo, isLoading, error } = useNGO(id || "");
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  if (isLoading) {
    return (
      <MainLayout title="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-12" />
          <Skeleton className="h-96" />
        </div>
      </MainLayout>
    );
  }

  if (error || !ngo) {
    return (
      <MainLayout title="NGO Not Found">
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">NGO not found</h3>
          <p className="text-muted-foreground mb-4">
            The NGO you're looking for doesn't exist or you don't have access.
          </p>
          <Button onClick={() => navigate("/ngos")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to NGOs
          </Button>
        </div>
      </MainLayout>
    );
  }

  const displayName = ngo.common_name || ngo.legal_name;
  const location = [ngo.city, ngo.state_province, ngo.country].filter(Boolean).join(", ");

  return (
    <MainLayout
      title=""
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditSheetOpen(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setActiveTab("work-items")}>
                View Work Items
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab("documents")}>
                View Documents
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Archive NGO
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      {/* Back button and header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/ngos")}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to NGOs
        </Button>

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-foreground">
                {displayName}
              </h1>
              <StatusChip status={statusMap[ngo.status] || "draft"} />
            </div>
            <p className="text-muted-foreground">
              {ngo.legal_name !== displayName && `${ngo.legal_name} • `}
              {ngo.bundle || "No bundle"} Bundle
              {location && ` • ${location}`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-2">
            <Building2 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="work-items" className="gap-2">
            <ListTodo className="w-4 h-4" />
            Work Items
          </TabsTrigger>
          <TabsTrigger value="forms" className="gap-2">
            <FileText className="w-4 h-4" />
            Forms
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="w-4 h-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="w-4 h-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <NGOOverviewTab ngo={ngo} onEdit={() => setEditSheetOpen(true)} />
        </TabsContent>

        <TabsContent value="work-items">
          <NGOWorkItemsTab ngoId={ngo.id} />
        </TabsContent>

        <TabsContent value="forms">
          <NGOFormsTab ngoId={ngo.id} />
        </TabsContent>

        <TabsContent value="documents">
          <NGODocumentsTab ngoId={ngo.id} />
        </TabsContent>

        <TabsContent value="calendar">
          <NGOCalendarTab ngoId={ngo.id} />
        </TabsContent>

        <TabsContent value="activity">
          <NGOActivityTab ngoId={ngo.id} />
        </TabsContent>
      </Tabs>

      {/* Edit Sheet */}
      <NGOEditSheet 
        ngo={ngo} 
        open={editSheetOpen} 
        onOpenChange={setEditSheetOpen} 
      />
    </MainLayout>
  );
}
