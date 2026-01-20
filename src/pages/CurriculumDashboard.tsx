import { useMemo, useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurriculumAssets } from "@/hooks/useCurriculumAssets";
import { useWorkItems } from "@/hooks/useWorkItems";
import { CurriculumAssetDrawer } from "@/components/curriculum/CurriculumAssetDrawer";
import { CurriculumChangeRequestDrawer } from "@/components/curriculum/CurriculumChangeRequestDrawer";
import { Link } from "react-router-dom";
import { FilePlus, Pencil } from "lucide-react";

export default function CurriculumDashboard() {
  const { data: assets = [], isLoading } = useCurriculumAssets();
  const { data: workItems = [] } = useWorkItems({ module: "curriculum" });

  const [search, setSearch] = useState("");
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    if (!search) return assets;
    const query = search.toLowerCase();
    return assets.filter((asset) =>
      asset.title.toLowerCase().includes(query) ||
      asset.description?.toLowerCase().includes(query) ||
      asset.language?.toLowerCase().includes(query)
    );
  }, [assets, search]);

  const changeRequests = useMemo(() => {
    return workItems.filter((item) => item.type?.toLowerCase() === "change request");
  }, [workItems]);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) || null;

  return (
    <MainLayout
      title="Curriculum Dashboard"
      subtitle="Manage curriculum assets and change requests"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setChangeRequestOpen(true)}>
            New Change Request
          </Button>
          <Button onClick={() => {
            setSelectedAssetId(null);
            setAssetDrawerOpen(true);
          }}>
            <FilePlus className="w-4 h-4 mr-2" />
            New Asset
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Input
              placeholder="Search curriculum assets"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Loading assets...
                    </TableCell>
                  </TableRow>
                ) : filteredAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No curriculum assets found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.title}</TableCell>
                      <TableCell>{asset.version || "-"}</TableCell>
                      <TableCell>{asset.audience || "-"}</TableCell>
                      <TableCell>{asset.format || "-"}</TableCell>
                      <TableCell>{asset.language || "-"}</TableCell>
                      <TableCell>
                        {asset.last_updated_at ? format(new Date(asset.last_updated_at), "PPP") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{asset.status || "Draft"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAssetId(asset.id);
                            setAssetDrawerOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-semibold">{changeRequests.length}</p>
                  <p className="text-sm text-muted-foreground">Open curriculum change requests</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setChangeRequestOpen(true)}>
                  New Request
                </Button>
              </div>
              <div className="space-y-2">
                {changeRequests.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.status.replace(/_/g, " ")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{item.priority}</Badge>
                      <Button variant="link" size="sm" asChild>
                        <Link to="/work-items">Open</Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {changeRequests.length === 0 && (
                  <p className="text-sm text-muted-foreground">No change requests logged yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approvals</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Change requests submitted from this dashboard will trigger approval workflows for the
              Curriculum department lead.
            </CardContent>
          </Card>
        </div>
      </div>

      <CurriculumAssetDrawer
        open={assetDrawerOpen}
        onOpenChange={setAssetDrawerOpen}
        asset={selectedAsset}
      />

      <CurriculumChangeRequestDrawer
        open={changeRequestOpen}
        onOpenChange={setChangeRequestOpen}
      />
    </MainLayout>
  );
}
