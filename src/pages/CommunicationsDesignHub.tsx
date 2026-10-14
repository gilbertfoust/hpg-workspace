import { useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormRunnerSheet } from "@/components/forms/FormRunnerSheet";
import { useFormTemplates } from "@/hooks/useFormTemplates";
import { useWorkItems } from "@/hooks/useWorkItems";

const normalizeStatus = (status: string) => status.toLowerCase().replace(/[_\s]+/g, " ");
const lanes = [
  { label: "Intake", statuses: ["draft", "not started", "waiting on ngo", "waiting on hpg"] },
  { label: "Production", statuses: ["in progress"] },
  { label: "Review", statuses: ["submitted", "under review", "approved"] },
  { label: "Delivered", statuses: ["complete", "completed"] },
];

export default function CommunicationsDesignHub() {
  const [open, setOpen] = useState(false);
  const forms = useFormTemplates();
  const queue = useWorkItems({ module: "communications", type: "Communications Graphic Design" });
  const template = forms.data?.find((form) => form.id === "b1b65b30-3c73-4cda-85d0-2f1cb0509b84" && form.is_active && form.module === "communications") || null;
  const items = (queue.data || []).filter((item) => !item.deleted_at && !["canceled", "rejected"].includes(normalizeStatus(item.status)));
  const knownStatuses = lanes.flatMap((lane) => lane.statuses);
  const uncategorized = items.filter((item) => !knownStatuses.includes(normalizeStatus(item.status)));

  return (
    <MainLayout title="Communications" subtitle="Messaging, publications, and flyer and graphic design production">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Flyer & Graphic Design Requests</CardTitle>
            <CardDescription>Submit a brief to Communications and follow its production and review progress.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => setOpen(true)} disabled={!template || forms.isLoading}>Request flyer or graphic</Button>
            <Button variant="outline" asChild><Link to="/department-forms?department=Communications">Communications forms</Link></Button>
            <Button variant="outline" asChild><Link to="/documents">Documents</Link></Button>
            <Button variant="outline" asChild><Link to="/work-items">All work items</Link></Button>
            {forms.error && <p role="alert" className="w-full text-sm text-destructive">The request form could not load. Please refresh or contact IT.</p>}
            {!forms.isLoading && !forms.error && !template && <p className="w-full text-sm text-muted-foreground">The design request form is currently unavailable.</p>}
          </CardContent>
        </Card>
        {queue.isLoading ? <p role="status">Loading design requests…</p> : queue.error ? (
          <Card><CardContent className="space-y-3 p-4"><p role="alert">Design requests could not load.</p><Button variant="outline" onClick={() => void queue.refetch()}>Retry</Button></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[...lanes, ...(uncategorized.length ? [{ label: "Other status", statuses: [] }] : [])].map((lane) => {
              const cards = lane.label === "Other status" ? uncategorized : items.filter((item) => lane.statuses.includes(normalizeStatus(item.status)));
              return <Card key={lane.label}>
                <CardHeader><CardTitle className="flex items-center justify-between text-base">{lane.label}<Badge variant="secondary">{cards.length}</Badge></CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {cards.length === 0 && <p className="text-sm text-muted-foreground">No requests</p>}
                  {cards.map((item) => <Link key={item.id} to={`/work-items?workItemId=${item.id}`} className="block rounded-md border p-3 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.description && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{item.description}</p>}
                    <Badge variant="outline" className="mt-2">{normalizeStatus(item.status)}</Badge>
                  </Link>)}
                </CardContent>
              </Card>;
            })}
          </div>
        )}
        <FormRunnerSheet open={open} onOpenChange={setOpen} template={template} />
      </div>
    </MainLayout>
  );
}
