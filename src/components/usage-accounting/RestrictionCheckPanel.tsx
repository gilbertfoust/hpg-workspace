import { useGrantRestrictionRules } from "@/hooks/useGrantRestrictionRules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export function RestrictionCheckPanel({ costCenterId }: { costCenterId?: string }) {
  const { data: rules = [], isLoading } = useGrantRestrictionRules(costCenterId);

  if (isLoading) return null;
  if (rules.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <CardTitle className="text-sm text-green-800">No Restrictions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-green-700">No grant restriction rules apply to this cost center.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <CardTitle className="text-sm text-amber-800">Grant Restrictions Active</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.map(r => (
          <div key={r.id} className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Rule</Badge>
              <span className="text-muted-foreground">{r.notes || "Unnamed restriction"}</span>
            </div>
            {(r.restricted_categories_json as any[]).length > 0 && (
              <p className="text-amber-700">Restricted categories: {(r.restricted_categories_json as any[]).join(", ")}</p>
            )}
            {(r.allowed_account_ids_json as any[]).length > 0 && (
              <p className="text-amber-700">Only {(r.allowed_account_ids_json as any[]).length} allowed accounts</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
