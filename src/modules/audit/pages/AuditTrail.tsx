import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Search, Eye, Plus, Edit, Trash2, ArrowRight, History } from "lucide-react";
import { format } from "date-fns";

const ENTITY_TYPES = [
  "ngo", "work_item", "document", "transaction", "journal_entry",
  "contact", "user", "form_submission", "asset", "purchase_order"
];

const ACTION_TYPES = ["create", "update", "delete", "status_change", "approve", "reject"];

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <Plus className="h-3 w-3" />,
  insert: <Plus className="h-3 w-3" />,
  update: <Edit className="h-3 w-3" />,
  delete: <Trash2 className="h-3 w-3" />,
  status_change: <ArrowRight className="h-3 w-3" />,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  insert: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  status_change: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export default function AuditTrail() {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const { data: logs, isLoading } = useAuditLog({
    entity_type: entityFilter !== "all" ? entityFilter : undefined,
  });

  const filtered = (logs ?? []).filter((log) => {
    const matchSearch =
      log.entity_type.toLowerCase().includes(search.toLowerCase()) ||
      (log.entity_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (log.reason ?? "").toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === "all" || log.action_type === actionFilter;
    return matchSearch && matchAction;
  });

  const renderDiff = (before: any, after: any) => {
    if (!before && !after) return <p className="text-muted-foreground">No data</p>;
    
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);

    return (
      <div className="space-y-2">
        {Array.from(allKeys).map((key) => {
          const bVal = before?.[key];
          const aVal = after?.[key];
          const changed = JSON.stringify(bVal) !== JSON.stringify(aVal);

          if (!changed && !before) return null; // Skip unchanged on create

          return (
            <div key={key} className={`text-sm p-2 rounded ${changed ? "bg-muted" : ""}`}>
              <span className="font-medium text-muted-foreground">{key}:</span>
              <div className="flex items-center gap-2 mt-1">
                {before && (
                  <span className={changed ? "line-through text-destructive" : ""}>
                    {JSON.stringify(bVal) ?? "null"}
                  </span>
                )}
                {changed && before && after && <ArrowRight className="h-3 w-3" />}
                {after && changed && (
                  <span className="text-green-600 dark:text-green-400">
                    {JSON.stringify(aVal)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Audit Trail
          </h1>
          <p className="text-muted-foreground">Complete log of all data changes across the system</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by entity, ID, or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading audit trail...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No audit entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.entity_type.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={ACTION_COLORS[log.action_type] ?? "bg-muted"}>
                          <span className="flex items-center gap-1">
                            {ACTION_ICONS[log.action_type]}
                            {log.action_type.replace(/_/g, " ")}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.entity_id?.slice(0, 8) ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.reason || "—"}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedEntry(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Audit Entry Details
                {selectedEntry && (
                  <Badge className={ACTION_COLORS[selectedEntry.action_type] ?? "bg-muted"}>
                    {selectedEntry.action_type}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Entity Type</p>
                    <p className="font-medium">{selectedEntry.entity_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Entity ID</p>
                    <p className="font-mono text-xs">{selectedEntry.entity_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Timestamp</p>
                    <p>{format(new Date(selectedEntry.created_at), "PPpp")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Actor</p>
                    <p className="font-mono text-xs">{selectedEntry.actor_user_id || "System"}</p>
                  </div>
                </div>
                {selectedEntry.reason && (
                  <div>
                    <p className="text-muted-foreground text-sm">Reason</p>
                    <p className="text-sm mt-1">{selectedEntry.reason}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-sm mb-2">Changes</p>
                  <ScrollArea className="h-[300px] border rounded-md p-3">
                    {renderDiff(selectedEntry.before_json, selectedEntry.after_json)}
                  </ScrollArea>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
