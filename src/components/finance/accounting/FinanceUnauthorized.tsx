import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FinanceUnauthorized({ action = "perform this action" }: { action?: string }) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-4 w-4" />
          Finance access restricted
        </CardTitle>
        <CardDescription>You do not have permission to {action}. Contact a finance administrator.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Finance managers (Super Admin, Admin, VP Finance) can post, approve, void, and reconcile. NGO portal users cannot access the internal ledger.
      </CardContent>
    </Card>
  );
}
