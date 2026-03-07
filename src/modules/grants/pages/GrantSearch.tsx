import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGrantOpportunities } from "@/hooks/useGrantOpportunities";
import { OPPORTUNITY_STATUSES } from "@/modules/grants/types";
import { Search, ExternalLink, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function GrantSearch() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const { data: opportunities, isLoading } = useGrantOpportunities({ search: search || undefined, status: statusFilter || undefined });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Grant Search</h1>
          <p className="text-muted-foreground">Find grant opportunities by keyword, region, and funder</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by title or description..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {OPPORTUNITY_STATUSES.map(s => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading opportunities...</p>
        ) : !opportunities?.length ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No opportunities found. Adjust your filters or add new opportunities.</CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {opportunities.map(opp => (
              <Card key={opp.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/grants/profile/${opp.id}`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{opp.title}</CardTitle>
                      {(opp as any).grant_sources?.name && (
                        <p className="text-sm text-muted-foreground">{(opp as any).grant_sources.name}</p>
                      )}
                    </div>
                    <Badge variant={opp.status === "open" ? "default" : "secondary"}>{opp.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {opp.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{opp.description}</p>}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {opp.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Deadline: {format(new Date(opp.deadline), "MMM d, yyyy")}
                      </span>
                    )}
                    {(opp.min_award || opp.max_award) && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {opp.min_award ? `$${opp.min_award.toLocaleString()}` : "—"} – {opp.max_award ? `$${opp.max_award.toLocaleString()}` : "—"}
                      </span>
                    )}
                    {opp.country && <span>📍 {opp.country}</span>}
                    {opp.url && (
                      <a href={opp.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline" onClick={e => e.stopPropagation()}>
                        <ExternalLink className="h-3 w-3" /> Website
                      </a>
                    )}
                  </div>
                  {opp.focus_areas?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {opp.focus_areas.map(area => <Badge key={area} variant="outline" className="text-xs">{area}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
