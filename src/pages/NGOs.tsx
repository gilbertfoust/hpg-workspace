import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { MainLayout } from "@/components/layout/MainLayout";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";
import { StatusChip } from "@/components/common/StatusChip";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

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

import {
  Plus,
  Search,
  Filter,
  Building2,
  MapPin,
  Users,
  MoreHorizontal,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { useNGOs, useCreateNGO, NGOStatus, DbFiscalType } from "@/hooks/useNGOs";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";

// ✅ DB values we will send to Supabase (must match the enum exactly)
const fiscalTypes = [
  { label: "Model A", value: "model_a" },
  { label: "Model C", value: "model_c" },
  { label: "HPG Internal Project", value: "HPG Internal Project" }, // keep exact enum string
  { label: "Other", value: "other" },
] as const;

const bundles = ["All Bundles", "Detroit", "Chicago", "US", "Mexican", "African", "Asian"];
const statuses = ["All Statuses", "Prospect", "Onboarding", "Active", "At-Risk", "Offboarding", "Closed"];

const statusValueMap: Record<string, NGOStatus> = {
  Prospect: "Prospect",
  Onboarding: "Onboarding",
  Active: "Active",
  "At-Risk": "At-Risk",
  Offboarding: "Offboarding",
  Closed: "Closed",
};

const statusMap: Record<
  string,
  "approved" | "in-progress" | "rejected" | "draft" | "waiting-ngo"
> = {
  Active: "approved",
  Onboarding: "in-progress",
  "At-Risk": "rejected",
  Prospect: "draft",
  Offboarding: "waiting-ngo",
  Closed: "rejected",
};

function formatFiscalType(value: string | null | undefined): string {
  if (!value) return "";
  if (value === "model_a") return "Model A";
  if (value === "model_c") return "Model C";
  if (value === "other") return "Other";
  return value; // includes "HPG Internal Project" or any legacy enum values
}

function isValidUrl(url: string): boolean {
  if (!url.trim()) return true; // Empty is valid (optional field)
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractConfluenceUrl(ngo: { notes?: string | null } & Record<string, unknown>) {
  const direct = (ngo as { confluence_url?: string | null }).confluence_url;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const notes = ngo.notes ?? "";
  const match = notes.match(/Confluence\s*:\s*(https?:\/\/\S+)/i);
  return match?.[1]?.trim();
}

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
    fiscal_type: "model_c" as DbFiscalType, // DB value
    status: "Prospect" as NGOStatus,
    confluence_url: "",
    notes: "",
  });

  const filteredNGOs = useMemo(() => {
    const list = ngos ?? [];
    const q = searchQuery.trim().toLowerCase();

    return list.filter((ngo) => {
      const matchesSearch =
        ngo.legal_name.toLowerCase().includes(q) ||
        (ngo.common_name?.toLowerCase().includes(q) ?? false) ||
        (ngo.city?.toLowerCase().includes(q) ?? false);

      const matchesBundle = selectedBundle === "All Bundles" || ngo.bundle === selectedBundle;

      const matchesStatus =
        selectedStatus === "All Statuses" || ngo.status === statusValueMap[selectedStatus];

      return matchesSearch && matchesBundle && matchesStatus;
    });
  }, [ngos, searchQuery, selectedBundle, selectedStatus]);

  const handleCreateNGO = async () => {
    if (!newNGO.legal_name.trim()) return;

    const confluence = newNGO.confluence_url.trim();
    const baseNotes = newNGO.notes.trim();

    // Validate Confluence URL if provided
    if (confluence && !isValidUrl(confluence)) {
      // URL validation failed, but don't block create - just warn
      console.warn("Invalid Confluence URL format:", confluence);
    }

    // Prepare notes: append Confluence link if no dedicated column exists
    // Try to use confluence_url column first, fallback to notes if column doesn't exist
    const notesParts = [baseNotes];
    if (confluence && isValidUrl(confluence)) {
      // If confluence_url column exists, it will be set separately
      // Otherwise, append to notes as fallback
      notesParts.push(`Confluence: ${confluence}`);
    }
    const combinedNotes = notesParts.filter(Boolean).join("\n") || undefined;

    try {
      await createNGO.mutateAsync({
        legal_name: newNGO.legal_name.trim(),
        common_name: newNGO.common_name.trim() || undefined,
        bundle: newNGO.bundle || undefined,
        country: newNGO.country.trim() || undefined,
        state_province: newNGO.state_province.trim() || undefined,
        city: newNGO.city.trim() || undefined,
        website: newNGO.website.trim() || undefined,
        fiscal_type: newNGO.fiscal_type, // Already DB-safe value
        status: newNGO.status,
        confluence_url: confluence && isValidUrl(confluence) ? confluence : undefined,
        notes: combinedNotes,
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
        fiscal_type: "model_c",
        status: "Prospect",
        confluence_url: "",
        notes: "",
      });
    } catch {
      // Keep modal open so you can adjust input and try again.
    }
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
                  <Select
                    value={newNGO.bundle}
                    onValueChange={(v) => setNewNGO({ ...newNGO, bundle: v })}
                  >
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
                  <Select
                    value={newNGO.fiscal_type}
                    onValueChange={(v) => setNewNGO({ ...newNGO, fiscal_type: v as DbFiscalType })}
                  >
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
                  <Select
                    value={newNGO.status}
                    onValueChange={(v) => setNewNGO({ ...newNGO, status: v as NGOStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prospect">Prospect</SelectItem>
                      <SelectItem value="Onboarding">Onboarding</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="At-Risk">At-Risk</SelectItem>
                      <SelectItem value="Offboarding">Offboarding</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* NEW: Confluence link */}
              <div className="space-y-2">
                <Label htmlFor="confluence_url">Confluence Link (URL)</Label>
                <Input
                  id="confluence_url"
                  type="url"
                  value={newNGO.confluence_url}
                  onChange={(e) => setNewNGO({ ...newNGO, confluence_url: e.target.value })}
                  placeholder="https://your-confluence/wiki/spaces/..."
                />
                <p className="text-xs text-muted-foreground">
                  Stored in notes as “Confluence: URL” unless you add a dedicated column.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={newNGO.notes}
                  onChange={(e) => setNewNGO({ ...newNGO, notes: e.target.value })}
                  placeholder="Optional notes (intake, compliance, context, etc.)"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateNGO}
                disabled={createNGO.isPending || !newNGO.legal_name.trim()}
              >
                {createNGO.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create NGO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search NGOs by name, common name, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="w-4 h-4" />
            Filters
          </div>

          <Select value={selectedBundle} onValueChange={setSelectedBundle}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bundles.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="grid gap-4 mt-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}

        {!isLoading &&
          filteredNGOs.map((ngo) => {
            const confluenceUrl = extractConfluenceUrl(ngo as unknown as Record<string, unknown> & { notes?: string | null });
            const location = [ngo.city, ngo.country].filter(Boolean).join(", ");
            const fiscalLabel = formatFiscalType(String(ngo.fiscal_type ?? ""));
            const statusVariant = statusMap[ngo.status] ?? "draft";

            return (
              <Card
                key={ngo.id}
                className="cursor-pointer hover:border-primary/60 transition-colors"
                onClick={() => navigate(`/ngos/${ngo.id}`)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold truncate">{ngo.legal_name}</h3>
                      </div>
                      {ngo.common_name ? (
                        <p className="text-sm text-muted-foreground truncate">{ngo.common_name}</p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusChip status={statusVariant} label={ngo.status} />

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="NGO actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ngos/${ngo.id}`);
                            }}
                          >
                            Open NGO
                          </DropdownMenuItem>

                          {ngo.website ? (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(ngo.website!, "_blank", "noreferrer");
                              }}
                            >
                              Open website
                            </DropdownMenuItem>
                          ) : null}

                          {confluenceUrl ? (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(confluenceUrl, "_blank", "noreferrer");
                              }}
                            >
                              Open Confluence
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-sm">
                    {location ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{location}</span>
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="truncate">
                        {ngo.bundle ? `${ngo.bundle} bundle` : "No bundle set"}
                        {fiscalLabel ? ` · ${fiscalLabel}` : ""}
                      </span>
                    </div>

                    {ngo.website ? (
                      <a
                        href={ngo.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline w-fit"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Website <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : null}

                    {confluenceUrl ? (
                      <a
                        href={confluenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline w-fit"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Confluence <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {!isLoading && filteredNGOs.length === 0 ? (
        <div className="mt-10 text-center text-muted-foreground">
          No NGOs match your current filters.
        </div>
      ) : null}
    </MainLayout>
  );
}
