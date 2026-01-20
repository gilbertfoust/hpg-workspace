import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Upload } from "lucide-react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useUploadDocument } from "@/hooks/useDocuments";
import { WorkItem } from "@/hooks/useWorkItems";

interface PortalContactRow {
  ngo_id: string | null;
  ngos: {
    id: string;
    legal_name: string;
    common_name: string | null;
  } | null;
}

interface NgoSummary {
  id: string;
  name: string;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  not_started: "Not started",
  in_progress: "In progress",
  waiting_on_ngo: "Waiting on NGO",
  waiting_on_hpg: "Waiting on HPG",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  complete: "Complete",
  canceled: "Canceled",
};

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy");
};

const formatStatus = (status: string | null) => {
  if (!status) return "—";
  return statusLabels[status] || status.replace(/_/g, " ");
};

export default function Portal() {
  const { user } = useAuth();
  const uploadDocument = useUploadDocument();
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: ngoContacts, isLoading: ngoLoading } = useQuery({
    queryKey: ["portal-ngos", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("contacts")
        .select("ngo_id, ngos(id, legal_name, common_name)")
        .eq("user_id", user?.id ?? "");

      if (error) throw error;
      return data as PortalContactRow[];
    },
  });

  const ngos = useMemo<NgoSummary[]>(() => {
    const unique = new Map<string, NgoSummary>();
    (ngoContacts || []).forEach((contact) => {
      if (contact.ngo_id && contact.ngos) {
        unique.set(contact.ngo_id, {
          id: contact.ngo_id,
          name: contact.ngos.common_name || contact.ngos.legal_name,
        });
      }
    });
    return Array.from(unique.values());
  }, [ngoContacts]);

  const ngoIds = useMemo(() => ngos.map((ngo) => ngo.id), [ngos]);
  const ngoNameLookup = useMemo(
    () => new Map(ngos.map((ngo) => [ngo.id, ngo.name])),
    [ngos],
  );

  const { data: workItems, isLoading: workItemsLoading } = useQuery({
    queryKey: ["portal-work-items", ngoIds],
    enabled: ngoIds.length > 0,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("work_items")
        .select("*")
        .in("ngo_id", ngoIds)
        .eq("external_visible", true)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as WorkItem[];
    },
  });

  const handleFileUpload = async (workItem: WorkItem, files: FileList | null) => {
    const file = files?.[0];
    if (!file || !workItem.ngo_id) return;

    try {
      setUploadingId(workItem.id);
      await uploadDocument.mutateAsync({
        file,
        ngoId: workItem.ngo_id,
        category: "other",
        workItemId: workItem.id,
        reviewStatus: "Pending",
      });
    } finally {
      setUploadingId(null);
    }
  };

  const isLoading = ngoLoading || workItemsLoading;

  return (
    <PortalLayout title="NGO Portal" subtitle="View tasks that require your attention and upload evidence.">
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="text-sm text-muted-foreground">Your NGOs</p>
              <div className="flex flex-wrap gap-2">
                {ngos.length > 0 ? (
                  ngos.map((ngo) => (
                    <Badge key={ngo.id} variant="secondary" className="px-3 py-1 text-sm">
                      {ngo.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No NGO association found.</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <p className="text-sm text-muted-foreground">External evidence uploads</p>
              <p className="text-sm text-foreground">
                Upload documents for items marked as requiring evidence. Files go straight to the review queue.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-semibold">External-visible work items</h2>
              <p className="text-sm text-muted-foreground">
                Showing tasks shared with your organization.
              </p>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : workItems && workItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NGO</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Evidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.ngo_id ? ngoNameLookup.get(item.ngo_id) || "—" : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatStatus(item.status)}</Badge>
                      </TableCell>
                      <TableCell>{item.type || "—"}</TableCell>
                      <TableCell>{formatDate(item.due_date)}</TableCell>
                      <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                        {item.description || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.evidence_required ? (
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="file"
                              className="hidden"
                              onChange={(event) => handleFileUpload(item, event.target.files)}
                              disabled={uploadingId === item.id}
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              asChild
                              disabled={uploadingId === item.id}
                            >
                              <span>
                                {uploadingId === item.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="mr-2 h-4 w-4" />
                                )}
                                Upload file
                              </span>
                            </Button>
                          </label>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not required</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-5 py-10 text-sm text-muted-foreground">
                No external-visible work items are available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
