import { useEffect, useMemo, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurriculumAssets } from "@/hooks/useCurriculumAssets";
import { useCreateWorkItem } from "@/hooks/useWorkItems";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CurriculumChangeRequestDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const urgencyOptions = ["Low", "Medium", "High", "Critical"];

export function CurriculumChangeRequestDrawer({ open, onOpenChange }: CurriculumChangeRequestDrawerProps) {
  const { data: assets } = useCurriculumAssets();
  const { data: orgUnits } = useOrgUnits();
  const { mutateAsync: createWorkItem, isPending } = useCreateWorkItem();
  const { toast } = useToast();

  const [assetId, setAssetId] = useState("");
  const [requestor, setRequestor] = useState("");
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState("Medium");

  useEffect(() => {
    if (open) {
      setAssetId("");
      setRequestor("");
      setSummary("");
      setReason("");
      setUrgency("Medium");
    }
  }, [open]);

  const curriculumOrgUnit = useMemo(() => {
    if (!orgUnits) return undefined;
    return orgUnits.find((unit) => {
      const department = unit.department_name?.toLowerCase();
      const subDepartment = unit.sub_department_name?.toLowerCase();
      return (department === "program" && subDepartment === "curriculum") || department === "curriculum";
    });
  }, [orgUnits]);

  const assetTitle = assets?.find((asset) => asset.id === assetId)?.title || "Curriculum asset";

  const handleSubmit = async () => {
    if (!summary.trim()) return;

    const workItem = await createWorkItem({
      module: "curriculum",
      type: "Change Request",
      title: `Curriculum change request: ${assetTitle}`,
      description: [
        `Asset: ${assetTitle}`,
        `Requestor: ${requestor || "N/A"}`,
        `Summary: ${summary}`,
        `Reason: ${reason || "N/A"}`,
        `Urgency: ${urgency}`,
      ].join("\n"),
      department_id: curriculumOrgUnit?.id,
      approval_required: true,
      priority: urgency === "Critical" || urgency === "High" ? "high" : "medium",
    });

    if (curriculumOrgUnit?.lead_user_id) {
      const { error } = await supabase
        .from("approvals")
        .insert({
          work_item_id: workItem.id,
          reviewer_user_id: curriculumOrgUnit.lead_user_id,
        });

      if (error) {
        toast({
          variant: "destructive",
          title: "Approval setup failed",
          description: error.message,
        });
      }
    }

    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh]">
        <DrawerHeader>
          <DrawerTitle>Curriculum Change Request</DrawerTitle>
          <DrawerDescription>Log requested updates and route them for approval.</DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-2">
            <Label>Target Asset</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select asset" />
              </SelectTrigger>
              <SelectContent>
                {assets?.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Requested Change Summary</Label>
            <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Requestor</Label>
              <Input value={requestor} onChange={(event) => setRequestor(event.target.value)} placeholder="Name or role" />
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
                  <SelectValue placeholder="Urgency" />
                </SelectTrigger>
                <SelectContent>
                  {urgencyOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </div>
        </div>

        <DrawerFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !summary.trim()}>
            Submit Change Request
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
