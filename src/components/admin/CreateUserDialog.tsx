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
import { Input } from "@/components/ui/input";
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
import { invokeAdminFunction, isNgoPortalRole } from "@/lib/invokeAdminFunction";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ADMIN_ASSIGNABLE_ROLES } from "@/lib/accessControl";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatNgoLabel = (legalName: string, commonName?: string | null) =>
  commonName ? `${commonName} (${legalName})` : legalName;

const isAssignableNgoStatus = (status: string) => {
  const normalized = status.toLowerCase();
  return ["active", "onboarding", "prospect", "at_risk"].includes(normalized);
};

export default function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff_member");
  const [ngoId, setNgoId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: ngos = [], isLoading: ngosLoading } = useNGOs();

  const requiresNgo = isNgoPortalRole(role);

  useEffect(() => {
    if (!open) {
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("staff_member");
      setNgoId("");
      setIsPrimary(false);
    }
  }, [open]);

  useEffect(() => {
    if (!requiresNgo) {
      setNgoId("");
      setIsPrimary(false);
    }
  }, [requiresNgo]);

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

  const handleCreate = async () => {
    if (!fullName || !email || !password) {
      toast({ variant: "destructive", title: "All fields are required" });
      return;
    }
    if (password.length < 8) {
      toast({ variant: "destructive", title: "Password must be at least 8 characters" });
      return;
    }
    if (requiresNgo && !ngoId) {
      toast({ variant: "destructive", title: "NGO is required for portal users" });
      return;
    }

    setLoading(true);
    try {
      await invokeAdminFunction("admin-create-user", {
        email,
        password,
        full_name: fullName,
        role,
        ...(requiresNgo ? { ngo_id: ngoId, is_primary: isPrimary } : {}),
      });

      toast({ title: "User created", description: `${fullName} has been added.` });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to create user",
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
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system. NGO portal users must be linked to an NGO.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_ASSIGNABLE_ROLES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresNgo && (
            <>
              <div className="space-y-2">
                <Label>Assigned NGO</Label>
                <Select value={ngoId} onValueChange={setNgoId} disabled={ngosLoading || loading}>
                  <SelectTrigger>
                    <SelectValue placeholder={ngosLoading ? "Loading NGOs..." : "Select NGO"} />
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
                  id="create-primary-contact"
                  checked={isPrimary}
                  onCheckedChange={(checked) => setIsPrimary(Boolean(checked))}
                  disabled={loading}
                />
                <Label htmlFor="create-primary-contact" className="font-normal">
                  Mark as primary contact
                </Label>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
