import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatusChip } from "@/components/common/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Building2,
  MapPin,
  Users,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNGOs, useCreateNGO, NGOStatus, FiscalType } from "@/hooks/useNGOs";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";

const statusMap: Record<string, "approved" | "in-progress" | "rejected" | "draft" | "waiting-ngo"> = {
  Active: "approved",
  Onboarding: "in-progress",
  "At-Risk": "rejected",
  Prospect: "draft",
  Offboarding: "waiting-ngo",
  Closed: "rejected",
};

const bundles = ["All Bundles", "Detroit", "Chicago", "US", "Mexican", "African", "Asian"];
const statuses = ["All Statuses", "Prospect", "Onboarding", "Active", "At-Risk", "Offboarding", "Closed"];

const statusValueMap: Record<string, NGOStatus> = {
  "Prospect": "Prospect",
  "Onboarding": "Onboarding",
  "Active": "Active",
  "At-Risk": "At-Risk",
  "Offboarding": "Offboarding",
  "Closed": "Closed",
};

const fiscalTypes: { label: string; value: FiscalType }[] = [
  { label: "Model A", value: "Model A" },
  { label: "Model C", value: "Model C" },
  { label: "Other", value: "Other" },
];

export default function NGOs() {
  const navigate = useNavigate();
  const { data: ngos, isLoading, error } = useNGOs();
  const createNGO = useCreateNGO();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBundle, setSelectedBundle] = useState("All Bundles");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // New NGO form state
  const [newNGO, setNewNGO] = useState({
    legal_name: "",
    common_name: "",
    bundle: "",
    country: "",
    state_province: "",
    city: "",
    website: "",
    fiscal_type: "Model C" as FiscalType,
    status: "Prospect" as NGOStatus,
    notes: "",
  });

  const filteredNGOs = ngos?.filter((ngo) => {
    const matchesSearch =
      ngo.legal_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ngo.common_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (ngo.city?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesBundle = selectedBundle === "All Bundles" || ngo.bundle === selectedBundle;
    const matchesStatus =
      selectedStatus === "All Statuses" ||
      ngo.status === statusValueMap[selectedStatus];

    return matchesSearch && matchesBundle && matchesStatus;
  }) || [];

  const handleCreateNGO = async () => {
    if (!newNGO.legal_name.trim()) return;

    await createNGO.mutateAsync({
      legal_name: newNGO.legal_name,
      common_name: newNGO.common_name || undefined,
      bundle: newNGO.bundle || undefined,
      country: newNGO.country || undefined,
      state_province: newNGO.state_province || undefined,
      city: newNGO.city || undefined,
      website: newNGO.website || undefined,
      fiscal_type: newNGO.fiscal_type,
      status: newNGO.status,
      notes: newNGO.notes || undefined,
    });

    setIsDialogOpen(false);
    setNewNGO({
      legal_name: "",
      common_name: "",
      bundle: "",
      country: "",
      state_province: "",
      city: "",
      website: "",
      fiscal_type: "Model C",
      status: "Prospect",
      notes: "",
    });
  };

  if (isSupabaseNotConfiguredError(error)) {
    return (
      <MainLayout title="NGOs">
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="NGOs"
      subtitle={`${ngos?.length || 0} organizations across ${bundles.length - 1} bundles`}
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add NGO
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New NGO</DialogTitle>
              <DialogDescription>
                Create a new NGO record. Required fields are marked with *.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legal_name">Legal Name *</Label>
                  <Input
                    id="legal_name"
                    value={newNGO.legal_name}
                    onChange={(e) => setNewNGO({ ...newNGO, legal_name: e.target.value })}
                    placeholder="Full legal organization name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="common_name">Common Name</Label>
                  <Input
                    id="common_name"
                    value={newNGO.common_name}
                    onChange={(e) => setNewNGO({ ...newNGO, common_name: e.target.value })}
                    placeholder="Display name or abbreviation"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bundle">Bundle</Label>
                  <Select value={newNGO.bundle} onValueChange={(v) => setNewNGO({ ...newNGO, bundle: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bundle" />
                    </SelectTrigger>
                    <SelectContent>
                      {bundles.slice(1).map((bundle) => (
                        <SelectItem key={bundle} value={bundle}>
                          {bundle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiscal_type">Fiscal Type</Label>
                  <Select value={newNGO.fiscal_type} onValueChange={(v) => setNewNGO({ ...newNGO, fiscal_type: v as FiscalType })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fiscalTypes.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>
                          {ft.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={newNGO.country}
                    onChange={(e) => setNewNGO({ ...newNGO, country: e.target.value })}
                    placeholder="Country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state_province">State/Province</Label>
                  <Input
                    id="state_province"
                    value={newNGO.state_province}
                    onChange={(e) => setNewNGO({ ...newNGO, state_province: e.target.value })}
                    placeholder="State or province"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={newNGO.city}
                    onChange={(e) => setNewNGO({ ...newNGO, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={newNGO.website}
                    onChange={(e) => setNewNGO({ ...newNGO, website: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Initial Status</Label>
                  <Select value={newNGO.status} onValueChange={(v) => setNewNGO({ ...newNGO, status: v as NGOStatus })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="Prospect">Prospect</SelectItem>
                      <SelectItem value="Onboarding">Onboarding</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateNGO} disabled={createNGO.isPending || !newNGO.legal_name.trim()}>
                {createNGO.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create NGO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search NGOs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedBundle} onValueChange={setSelectedBundle}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bundles.map((bundle) => (
              <SelectItem key={bundle} value={bundle}>
                {bundle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      )}

      {/* NGO Cards Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNGOs.map((ngo) => (
            <Card
              key={ngo.id}
              className="module-card group"
              onClick={() => navigate(`/ngos/${ngo.id}`)}
            >
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {ngo.common_name || ngo.legal_name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {ngo.legal_name}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit NGO</DropdownMenuItem>
                      <DropdownMenuItem>View Work Items</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>
                      {ngo.city || ngo.state_province || ngo.country || 'No location'}
                      {ngo.country && ngo.city && `, ${ngo.country}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span>{ngo.bundle || 'Unassigned'} Bundle</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <StatusChip status={statusMap[ngo.status] || "draft"} />
                    <span className="text-xs text-muted-foreground capitalize">
                      {ngo.fiscal_type}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredNGOs.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No NGOs found</h3>
          <p className="text-muted-foreground mb-4">
            {ngos?.length === 0 ? "Get started by adding your first NGO" : "Try adjusting your search or filters"}
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add First NGO
          </Button>
        </div>
      )}
    </MainLayout>
  );
}
