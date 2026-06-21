import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { FinanceVendor, FinanceVendorInput } from "@/types/financeAccounting";

interface FinanceVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: FinanceVendor | null;
  onSave: (input: FinanceVendorInput) => Promise<void>;
  isSaving?: boolean;
}

export function FinanceVendorDialog({
  open,
  onOpenChange,
  vendor,
  onSave,
  isSaving,
}: FinanceVendorDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [taxNotes, setTaxNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (vendor) {
      setName(vendor.name);
      setEmail(vendor.email || "");
      setPhone(vendor.phone || "");
      setAddress(vendor.address || "");
      setTaxNotes(vendor.tax_notes || "");
      setIsActive(vendor.is_active);
    } else {
      setName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setTaxNotes("");
      setIsActive(true);
    }
  }, [open, vendor]);

  const handleSubmit = async () => {
    await onSave({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      tax_notes: taxNotes.trim() || null,
      is_active: isActive,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit vendor" : "Add vendor"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Name *</Label>
            <Input id="vendor-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-email">Email</Label>
              <Input id="vendor-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input id="vendor-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-address">Address</Label>
            <Textarea id="vendor-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-tax">Tax notes</Label>
            <Textarea
              id="vendor-tax"
              value={taxNotes}
              onChange={(e) => setTaxNotes(e.target.value)}
              placeholder="W-9 on file, 1099 vendor, etc."
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <p className="text-sm font-medium">Active</p>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isSaving}>
            {vendor ? "Save changes" : "Create vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
