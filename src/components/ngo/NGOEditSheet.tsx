import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { NGO, useUpdateNGO, NGOStatus, FiscalType } from "@/hooks/useNGOs";

interface NGOEditSheetProps {
  ngo: NGO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const bundles = ["Detroit", "Chicago", "US", "Mexican", "African", "Asian"];

export function NGOEditSheet({ ngo, open, onOpenChange }: NGOEditSheetProps) {
  const updateNGO = useUpdateNGO();
  const [formData, setFormData] = useState({
    legal_name: ngo.legal_name,
    common_name: ngo.common_name || "",
    bundle: ngo.bundle || "",
    country: ngo.country || "",
    state_province: ngo.state_province || "",
    city: ngo.city || "",
    website: ngo.website || "",
    fiscal_type: ngo.fiscal_type,
    status: ngo.status,
    notes: ngo.notes || "",
  });

  useEffect(() => {
    setFormData({
      legal_name: ngo.legal_name,
      common_name: ngo.common_name || "",
      bundle: ngo.bundle || "",
      country: ngo.country || "",
      state_province: ngo.state_province || "",
      city: ngo.city || "",
      website: ngo.website || "",
      fiscal_type: ngo.fiscal_type,
      status: ngo.status,
      notes: ngo.notes || "",
    });
  }, [ngo]);

  const handleSave = async () => {
    await updateNGO.mutateAsync({
      id: ngo.id,
      ...formData,
      common_name: formData.common_name || null,
      bundle: formData.bundle || null,
      country: formData.country || null,
      state_province: formData.state_province || null,
      city: formData.city || null,
      website: formData.website || null,
      notes: formData.notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit NGO</SheetTitle>
          <SheetDescription>Update the NGO details below.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Legal Name *</Label>
            <Input value={formData.legal_name} onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Common Name</Label>
            <Input value={formData.common_name} onChange={(e) => setFormData({ ...formData, common_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bundle</Label>
              <Select value={formData.bundle} onValueChange={(v) => setFormData({ ...formData, bundle: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {bundles.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as NGOStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                  <SelectItem value="Onboarding">Onboarding</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="At-Risk">At Risk</SelectItem>
                  <SelectItem value="Offboarding">Offboarding</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={formData.state_province} onChange={(e) => setFormData({ ...formData, state_province: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Fiscal Type</Label>
            <Select value={formData.fiscal_type} onValueChange={(v) => setFormData({ ...formData, fiscal_type: v as FiscalType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Model A">Model A</SelectItem>
                <SelectItem value="Model C">Model C</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateNGO.isPending || !formData.legal_name.trim()}>
            {updateNGO.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
