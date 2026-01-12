import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatusChip } from "@/components/common/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Building2,
  MapPin,
  Users,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// Mock data
const mockNGOs = [
  {
    id: "1",
    legalName: "Detroit Community Foundation",
    commonName: "DCF",
    bundle: "Detroit",
    country: "USA",
    stateProvince: "Michigan",
    city: "Detroit",
    status: "active",
    fiscalType: "Model C",
    coordinator: "Jane Smith",
    openItems: 4,
  },
  {
    id: "2",
    legalName: "Chicago Youth Initiative Inc.",
    commonName: "CYI",
    bundle: "Chicago",
    country: "USA",
    stateProvince: "Illinois",
    city: "Chicago",
    status: "onboarding",
    fiscalType: "Model A",
    coordinator: "John Doe",
    openItems: 8,
  },
  {
    id: "3",
    legalName: "Alianza Educativa Mexicana A.C.",
    commonName: "AEM",
    bundle: "Mexican",
    country: "Mexico",
    stateProvince: "CDMX",
    city: "Mexico City",
    status: "active",
    fiscalType: "Model C",
    coordinator: "Maria Garcia",
    openItems: 2,
  },
  {
    id: "4",
    legalName: "African Youth Network Foundation",
    commonName: "AYNF",
    bundle: "African",
    country: "Kenya",
    stateProvince: "Nairobi",
    city: "Nairobi",
    status: "at-risk",
    fiscalType: "Model C",
    coordinator: "David Okonkwo",
    openItems: 12,
  },
  {
    id: "5",
    legalName: "Asian Development Partners",
    commonName: "ADP",
    bundle: "Asian",
    country: "Philippines",
    stateProvince: "Metro Manila",
    city: "Manila",
    status: "prospect",
    fiscalType: "Other",
    coordinator: "Unassigned",
    openItems: 0,
  },
];

const statusMap: Record<string, "approved" | "in-progress" | "rejected" | "draft" | "waiting-ngo"> = {
  active: "approved",
  onboarding: "in-progress",
  "at-risk": "rejected",
  prospect: "draft",
  offboarding: "waiting-ngo",
};

const bundles = ["All Bundles", "Detroit", "Chicago", "US", "Mexican", "African", "Asian"];
const statuses = ["All Statuses", "Prospect", "Onboarding", "Active", "At-Risk", "Offboarding", "Closed"];

export default function NGOs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBundle, setSelectedBundle] = useState("All Bundles");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");

  const filteredNGOs = mockNGOs.filter((ngo) => {
    const matchesSearch =
      ngo.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ngo.commonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ngo.city.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBundle = selectedBundle === "All Bundles" || ngo.bundle === selectedBundle;
    const matchesStatus =
      selectedStatus === "All Statuses" ||
      ngo.status.toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesBundle && matchesStatus;
  });

  return (
    <MainLayout
      title="NGOs"
      subtitle={`${mockNGOs.length} organizations across ${bundles.length - 1} bundles`}
      actions={
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add NGO
        </Button>
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

      {/* NGO Cards Grid */}
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
                      {ngo.commonName}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {ngo.legalName}
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
                    {ngo.city}, {ngo.country}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{ngo.coordinator}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-2">
                  <StatusChip status={statusMap[ngo.status] || "draft"} />
                  <span className="text-xs text-muted-foreground">{ngo.fiscalType}</span>
                </div>
                {ngo.openItems > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {ngo.openItems} open items
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredNGOs.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No NGOs found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search or filters
          </p>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add First NGO
          </Button>
        </div>
      )}
    </MainLayout>
  );
}
