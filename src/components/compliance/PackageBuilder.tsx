import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompliancePackages } from "@/hooks/useCompliancePackages";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Package, Loader2 } from "lucide-react";

interface Props {
  ngoId: string;
  fiscalYear: number;
}

const packageTypes = [
  { value: "990", label: "IRS Form 990" },
  { value: "ngo_annual", label: "NGO Annual Report" },
  { value: "audit", label: "Audit Package" },
];

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  ready_for_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
};

export function PackageBuilder({ ngoId, fiscalYear }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: packages, create, update } = useCompliancePackages(ngoId, fiscalYear);
  const [creating, setCreating] = useState(false);
  const [selectedType, setSelectedType] = useState("990");

  const handleCreate = async () => {
    setCreating(true);
    try {
      await create.mutateAsync({
        ngo_id: ngoId,
        fiscal_year: fiscalYear,
        package_type: selectedType,
        status: "draft",
        data_json: {},
        file_path: null,
        created_by_user_id: user?.id || null,
      });
      toast({ title: "Package created", description: `${selectedType} package for FY${fiscalYear} created.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await update.mutateAsync({ id, status });
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compliance Packages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {packageTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Package className="h-4 w-4 mr-1" />}
            Create Package
          </Button>
        </div>

        {(packages || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No packages created yet.</p>
        ) : (
          <div className="space-y-2">
            {(packages || []).map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <span className="font-medium text-sm">{packageTypes.find((t) => t.value === pkg.package_type)?.label || pkg.package_type}</span>
                  <span className="text-xs text-muted-foreground ml-2">FY{pkg.fiscal_year}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={pkg.status} onValueChange={(v) => handleStatusChange(pkg.id, v)}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="ready_for_review">Ready for Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
