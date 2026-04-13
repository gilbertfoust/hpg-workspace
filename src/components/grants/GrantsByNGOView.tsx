import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, DollarSign, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";

interface GrantApp {
  id: string;
  title: string;
  stage: string;
  amount_requested: number | null;
  notes: string | null;
  ngo_id: string;
  ngos?: { legal_name: string; common_name: string | null } | null;
  grant_opportunities?: { id: string; title: string; deadline: string | null } | null;
}

interface NGO {
  id: string;
  legal_name: string;
  common_name: string | null;
  bundle: string | null;
  country: string | null;
}

const STAGE_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  prospect: "outline",
  researching: "secondary",
  writing: "secondary",
  submitted: "default",
  under_review: "default",
  awarded: "default",
  declined: "destructive",
  reporting: "secondary",
  closed: "outline",
};

interface Props {
  applications: GrantApp[];
  ngos: NGO[];
  onSelect?: (app: GrantApp) => void;
}

export function GrantsByNGOView({ applications, ngos, onSelect }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, { ngo: NGO; apps: GrantApp[] }>();

    // Group assigned grants
    for (const app of applications) {
      if (!app.ngo_id) continue;
      if (!map.has(app.ngo_id)) {
        const ngo = ngos.find((n) => n.id === app.ngo_id);
        if (!ngo) continue;
        map.set(app.ngo_id, { ngo, apps: [] });
      }
      map.get(app.ngo_id)!.apps.push(app);
    }

    // Add NGOs with no grants
    for (const ngo of ngos) {
      if (!map.has(ngo.id)) {
        map.set(ngo.id, { ngo, apps: [] });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.apps.length - a.apps.length);
  }, [applications, ngos]);

  // Unassigned grants
  const unassigned = applications.filter((a) => !a.ngo_id);

  return (
    <div className="space-y-6">
      {unassigned.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Unassigned Grants
              <Badge variant="secondary">{unassigned.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {unassigned.slice(0, 10).map((app) => (
                <GrantRow key={app.id} app={app} onClick={() => onSelect?.(app)} />
              ))}
              {unassigned.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  +{unassigned.length - 10} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {grouped.map(({ ngo, apps }) => (
        <Card key={ngo.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {ngo.common_name || ngo.legal_name}
              <Badge variant="secondary">{apps.length}</Badge>
              {ngo.country && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {ngo.country}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {apps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No grants tracked yet</p>
            ) : (
              <div className="grid gap-2">
                {apps.map((app) => (
                  <GrantRow key={app.id} app={app} onClick={() => onSelect?.(app)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GrantRow({ app, onClick }: { app: GrantApp; onClick?: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{app.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {app.amount_requested && (
            <span className="flex items-center gap-0.5">
              <DollarSign className="h-3 w-3" />${app.amount_requested.toLocaleString()}
            </span>
          )}
          {(app as any).grant_opportunities?.deadline && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {format(new Date((app as any).grant_opportunities.deadline), "MMM d, yyyy")}
            </span>
          )}
        </div>
      </div>
      <Badge variant={STAGE_BADGE[app.stage] || "outline"} className="text-xs flex-shrink-0">
        {app.stage.replace(/_/g, " ")}
      </Badge>
    </div>
  );
}
