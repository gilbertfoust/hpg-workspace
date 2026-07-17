import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { useNGOs } from "@/hooks/useNGOs";
import { ADMIN_ASSIGNABLE_ROLES } from "@/lib/accessControl";

const ALL_ROLES = ADMIN_ASSIGNABLE_ROLES;
const ORG_RANKS = [
  ["chief_executive", "Chief Executive"],
  ["executive_vice_president", "Executive Vice President"],
  ["vice_president", "Vice President"],
  ["director", "Director"],
  ["manager", "Manager"],
  ["specialist", "Specialist"],
  ["coordinator", "Coordinator"],
  ["associate", "Associate"],
  ["staff", "Staff"],
] as const;
const NGO_ACCESS_LEVELS = [
  ["viewer", "Viewer"],
  ["preparer", "Accounting Preparer"],
  ["approver", "Quarterly Approver"],
  ["ngo_admin", "NGO Administrator"],
] as const;

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ngoOnly?: boolean;
}

export default function CreateUserDialog({ open, onOpenChange, ngoOnly = false }: CreateUserDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ngoOnly ? "external_ngo" : "staff_member");
  const [departmentId, setDepartmentId] = useState("");
  const [orgRank, setOrgRank] = useState("staff");
  const [ngoId, setNgoId] = useState("");
  const [ngoAccessLevel, setNgoAccessLevel] = useState("preparer");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: orgUnits = [] } = useOrgUnits();
  const { data: ngos = [] } = useNGOs();
  const isNgoRole = role === "external_ngo" || role === "ngo_user";

  const handleCreate = async () => {
    if (!fullName || !email || !password) {
      toast({ variant: "destructive", title: "All fields are required" });
      return;
    }
    if (password.length < 8) {
      toast({ variant: "destructive", title: "Password must be at least 8 characters" });
      return;
    }
    if (isNgoRole && !ngoId) {
      toast({ variant: "destructive", title: "Select the NGO this user belongs to" });
      return;
    }
    if (!isNgoRole && !departmentId) {
      toast({ variant: "destructive", title: "Select the staff member's department" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase!.functions.invoke("admin-create-user", {
        body: {
          email,
          password,
          full_name: fullName,
          role,
          department_id: isNgoRole ? null : departmentId,
          org_rank: isNgoRole ? null : orgRank,
          ngo_id: isNgoRole ? ngoId : null,
          ngo_access_level: isNgoRole ? ngoAccessLevel : null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "User created", description: `${fullName} has been added.` });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setFullName("");
      setEmail("");
      setPassword("");
      setRole(ngoOnly ? "external_ngo" : "staff_member");
      setDepartmentId("");
      setOrgRank("staff");
      setNgoId("");
      setNgoAccessLevel("preparer");
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to create user", description: err.message });
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
            {ngoOnly
              ? "Create an NGO-scoped portal account. It cannot open HPG's internal workspace."
              : "Create a staff or NGO user and assign the department, rank, and access boundary."}
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
          {!ngoOnly && <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>}
          {!isNgoRole && (
            <>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {orgUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.department_name}{unit.sub_department_name ? ` — ${unit.sub_department_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Organization rank</Label>
                <Select value={orgRank} onValueChange={setOrgRank}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ORG_RANKS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
          {isNgoRole && (
            <>
              <div className="space-y-2">
                <Label>NGO</Label>
                <Select value={ngoId} onValueChange={setNgoId}>
                  <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                  <SelectContent>{ngos.map((ngo) => <SelectItem key={ngo.id} value={ngo.id}>{ngo.common_name || ngo.legal_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>NGO portal access</Label>
                <Select value={ngoAccessLevel} onValueChange={setNgoAccessLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{NGO_ACCESS_LEVELS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
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
