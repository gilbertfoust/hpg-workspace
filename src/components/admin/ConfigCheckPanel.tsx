import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Server } from "lucide-react";

interface EnvVarStatus {
  name: string;
  displayName: string;
  present: boolean;
  isPublic: boolean;
}

const ConfigCheckPanel = () => {
  // Check environment variables (only checking presence, not values)
  const envVars: EnvVarStatus[] = [
    {
      name: "VITE_SUPABASE_URL",
      displayName: "Backend URL",
      present: !!import.meta.env.VITE_SUPABASE_URL,
      isPublic: true,
    },
    {
      name: "VITE_SUPABASE_PUBLISHABLE_KEY",
      displayName: "API Key (Public)",
      present: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      isPublic: true,
    },
    {
      name: "VITE_SUPABASE_PROJECT_ID",
      displayName: "Project ID",
      present: !!import.meta.env.VITE_SUPABASE_PROJECT_ID,
      isPublic: true,
    },
  ];

  const allPresent = envVars.every((v) => v.present);
  const somePresent = envVars.some((v) => v.present);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5" />
          Configuration Status
        </CardTitle>
        <CardDescription>
          Environment variables and backend connectivity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="font-medium">Overall Status</span>
            {allPresent ? (
              <Badge className="bg-success/10 text-success gap-1">
                <CheckCircle2 className="w-3 h-3" />
                All Configured
              </Badge>
            ) : somePresent ? (
              <Badge className="bg-warning/10 text-warning gap-1">
                <AlertCircle className="w-3 h-3" />
                Partially Configured
              </Badge>
            ) : (
              <Badge className="bg-destructive/10 text-destructive gap-1">
                <XCircle className="w-3 h-3" />
                Not Configured
              </Badge>
            )}
          </div>

          {/* Individual Variables */}
          <div className="space-y-2">
            {envVars.map((envVar) => (
              <div
                key={envVar.name}
                className="flex items-center justify-between py-2 px-3 rounded border"
              >
                <div className="flex items-center gap-2">
                  {envVar.present ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                  <span className="text-sm font-medium">{envVar.displayName}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {envVar.present ? "Present" : "Missing"}
                </Badge>
              </div>
            ))}
          </div>

          {/* Info Note */}
          <p className="text-xs text-muted-foreground mt-4">
            Environment variables are managed via Lovable Cloud. Values are never
            displayed for security.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConfigCheckPanel;
