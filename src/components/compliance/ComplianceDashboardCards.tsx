import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Package, Lock, BarChart3 } from "lucide-react";

interface Props {
  statementsCount: number;
  packagesCount: number;
  packagesApproved: number;
  isLocked: boolean;
}

export function ComplianceDashboardCards({ statementsCount, packagesCount, packagesApproved, isLocked }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Statements</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="text-2xl font-bold">{statementsCount}</span>
          <span className="text-sm text-muted-foreground">/ 4</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Packages</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <span className="text-2xl font-bold">{packagesCount}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-green-600" />
          <span className="text-2xl font-bold">{packagesApproved}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Year Status</CardTitle></CardHeader>
        <CardContent>
          {isLocked ? (
            <Badge className="bg-green-100 text-green-800"><Lock className="h-3 w-3 mr-1" /> Locked</Badge>
          ) : (
            <Badge variant="outline">Open</Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
