import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useNGOs } from "@/hooks/useNGOs";
import { invokeAdminFunction } from "@/lib/invokeAdminFunction";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface AssignNgoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const formatNgoLabel = (legalName: string, commonName?: string | null) =>
  commonName ? `${commonName} (${legalName})` : legalName;

const isAssignableNgoStatus = (status: string) => {
  const normalized = status.toLowerCase();
  return ["active", "onboarding", "prospect", "at_risk"].includes(normalized);
};

export default function AssignNgoDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: AssignNgoDialogProps) {
  const { data: ngos = [], isLoading } = useNGOs();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ngoId, setNgoId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setNgoId("");
      setIsPrimary(false);
    }
  }, [open]);

  const ngoOptions = useMemo(
    () =>
      ngos
        .filter((ngo) => isAssignableNgoStatus(ngo.status))
        .sort((a, b) =>
          formatNgoLabel(a.legal_name, a.common_name).localeCompare(
            formatNgoLabel(b.legal_name, b.common_name),
          ),
        ),
    [ngos],
  );

  const handleAssign = async () => {
    if (!ngoId) {
      toast({ variant: "destructive", title: "Select an NGO" });
      return;
    }

    setLoading(true);
    try {
      await invokeAdminFunction("admin-assign-ngo", {
        target_user_id: userId,
        ngo_id: ngoId,
        is_primary: isPrimary,
      });

      toast({
        title: "NGO assignment saved",
        description: `${userName} is now linked to the selected NGO portal.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to assign NGO",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to NGO</DialogTitle>
          <DialogDescription>
            Link {userName} to an NGO for portal access via the contacts table.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>NGO</Label>
            <Select value={ngoId} onValueChange={setNgoId} disabled={isLoading || loading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Loading NGOs..." : "Select NGO"} />
              </SelectTrigger>
              <SelectContent>
                {ngoOptions.map((ngo) => (
                  <SelectItem key={ngo.id} value={ngo.id}>
                    {formatNgoLabel(ngo.legal_name, ngo.common_name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="assign-primary-contact"
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(Boolean(checked))}
              disabled={loading}
            />
            <Label htmlFor="assign-primary-contact" className="font-normal">
              Mark as primary contact
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading || !ngoId}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Assign NGO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
