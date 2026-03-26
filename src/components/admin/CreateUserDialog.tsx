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

const ALL_ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin_pm", label: "Admin PM" },
  { value: "executive_secretariat", label: "Executive Secretariat" },
  { value: "ngo_coordinator", label: "NGO Coordinator" },
  { value: "department_lead", label: "Department Lead" },
  { value: "staff_member", label: "Staff Member" },
  { value: "external_ngo", label: "External NGO Portal" },
];

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff_member");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!fullName || !email || !password) {
      toast({ variant: "destructive", title: "All fields are required" });
      return;
    }
    if (password.length < 8) {
      toast({ variant: "destructive", title: "Password must be at least 8 characters" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase!.functions.invoke("admin-create-user", {
        body: { email, password, full_name: fullName, role },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "User created", description: `${fullName} has been added.` });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("staff_member");
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
            Add a new user to the system. They will be able to sign in immediately.
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
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
