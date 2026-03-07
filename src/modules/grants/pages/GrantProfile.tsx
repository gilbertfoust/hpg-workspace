import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, DollarSign, ExternalLink, Globe } from "lucide-react";
import { format } from "date-fns";

export default function GrantProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: opportunity, isLoading } = useQuery({
    queryKey: ["grant_opportunity", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grant_opportunities")
        .select("*, grant_sources(id, name, funder_type, website, description)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) return <MainLayout><p className="text-muted-foreground p-6">Loading...</p></MainLayout>;
  if (!opportunity) return <MainLayout><p className="text-muted-foreground p-6">Opportunity not found</p></MainLayout>;

  const source = (opportunity as any).grant_sources;

  return (
    <MainLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/grants/search")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Search
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{opportunity.title}</h1>
            {source && <p className="text-muted-foreground">{source.name} · {source.funder_type}</p>}
          </div>
          <Badge variant={opportunity.status === "open" ? "default" : "secondary"}>{opportunity.status}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {opportunity.deadline && (
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Deadline</p>
                  <p className="font-medium">{format(new Date(opportunity.deadline), "MMMM d, yyyy")}</p>
                </div>
              </CardContent>
            </Card>
          )}
          {(opportunity.min_award || opportunity.max_award) && (
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Award Range</p>
                  <p className="font-medium">
                    {opportunity.min_award ? `$${opportunity.min_award.toLocaleString()}` : "—"} – {opportunity.max_award ? `$${opportunity.max_award.toLocaleString()}` : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {opportunity.country && (
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium">{opportunity.country}{opportunity.region ? ` · ${opportunity.region}` : ""}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {opportunity.description && (
          <Card>
            <CardHeader><CardTitle>Description</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{opportunity.description}</p></CardContent>
          </Card>
        )}

        {opportunity.eligibility_criteria && (
          <Card>
            <CardHeader><CardTitle>Eligibility Criteria</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{opportunity.eligibility_criteria}</p></CardContent>
          </Card>
        )}

        {opportunity.focus_areas?.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Focus Areas</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {opportunity.focus_areas.map((area: string) => <Badge key={area} variant="outline">{area}</Badge>)}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          {opportunity.url && (
            <Button variant="outline" asChild>
              <a href={opportunity.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" />View on Funder Site</a>
            </Button>
          )}
          <Button onClick={() => navigate("/grants/pipeline")}>Start Application</Button>
        </div>
      </div>
    </MainLayout>
  );
}
