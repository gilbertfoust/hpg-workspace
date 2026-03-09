import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuditLog } from "@/hooks/useAuditLog";
import { KeyRound, Search } from "lucide-react";
import { format } from "date-fns";

export default function PermissionChanges() {
  const [search, setSearch] = useState("");
  const { data: logs, isLoading } = useAuditLog({ entity_type: "user_role" });

  // Also include user entity changes that are permission-related
  const { data: userLogs } = useAuditLog({ entity_type: "user" });

  const allLogs = [
    ...(logs ?? []),
    ...(userLogs ?? []).filter((l) => {
      const after = l.after_json as any;
      const before = l.before_json as any;
      return after?.role || before?.role || l.action_type === "status_change";
    }),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filtered = allLogs.filter(
    (l) =>
      (l.entity_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (l.reason ?? "").toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(l.after_json).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            Permission Changes
          </h1>
          <p className="text-muted-foreground">Track all role assignments and access modifications</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by user, role, or reason…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User / Entity ID</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : !filtered.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No permission changes found</TableCell></TableRow>
                ) : (
                  filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(log.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <Badge variant={log.action_type === "delete" ? "destructive" : "secondary"}>
                          {log.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.entity_id?.slice(0, 12) ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {log.before_json ? JSON.stringify(log.before_json) : "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">
                        {log.after_json ? JSON.stringify(log.after_json) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.reason || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
