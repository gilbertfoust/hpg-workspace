import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useHRChecklists, useChecklistAssignments } from "@/hooks/useHRChecklists";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { ClipboardList, Plus, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function OnboardingDashboard() {
  const { data: checklists, create: createChecklist } = useHRChecklists();
  const { data: assignments, assign, updateStatus } = useChecklistAssignments();
  const { data: staff } = useStaffProfiles();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: "", checklist_type: "onboarding", items: "" });
  const [assignForm, setAssignForm] = useState({ staff_id: "", checklist_id: "" });

  const handleCreateTemplate = () => {
    const items = templateForm.items.split("\n").filter(Boolean).map(text => ({ text, required: true }));
    createChecklist.mutate({ name: templateForm.name, checklist_type: templateForm.checklist_type, items }, {
      onSuccess: () => { setTemplateOpen(false); setTemplateForm({ name: "", checklist_type: "onboarding", items: "" }); },
    });
  };

  const handleAssign = () => {
    if (!assignForm.staff_id || !assignForm.checklist_id) return;
    assign.mutate({ staffId: assignForm.staff_id, checklistId: assignForm.checklist_id }, {
      onSuccess: () => { setAssignOpen(false); setAssignForm({ staff_id: "", checklist_id: "" }); },
    });
  };

  const toggleItem = (assignmentId: string, itemIndex: number, currentStatuses: Record<string, boolean>) => {
    const key = String(itemIndex);
    const newStatuses = { ...currentStatuses, [key]: !currentStatuses[key] };
    const items = checklists?.find(c => assignments?.find(a => a.id === assignmentId)?.checklist_id === c.id)?.items as unknown[];
    const totalItems = Array.isArray(items) ? items.length : 0;
    const completedCount = Object.values(newStatuses).filter(Boolean).length;
    const status = completedCount >= totalItems ? "completed" : completedCount > 0 ? "in_progress" : "pending";
    updateStatus.mutate({ id: assignmentId, status, itemStatuses: newStatuses });
  };

  const getProgress = (assignment: any) => {
    const items = (assignment.hr_checklists?.items || []) as unknown[];
    if (!items.length) return 0;
    const completed = Object.values(assignment.item_statuses || {}).filter(Boolean).length;
    return Math.round((completed / items.length) * 100);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6" />Onboarding & Offboarding</h1>
            <p className="text-muted-foreground">Checklists for employee lifecycle management</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Assign Checklist</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Assign Checklist</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Staff Member</Label>
                    <Select value={assignForm.staff_id} onValueChange={v => setAssignForm(f => ({ ...f, staff_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Checklist Template</Label>
                    <Select value={assignForm.checklist_id} onValueChange={v => setAssignForm(f => ({ ...f, checklist_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{checklists?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.checklist_type})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={handleAssign} disabled={!assignForm.staff_id || !assignForm.checklist_id}>Assign</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
              <DialogTrigger asChild><Button variant="outline">New Template</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Checklist Template</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Name</Label><Input value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. New Hire Onboarding" /></div>
                  <div>
                    <Label>Type</Label>
                    <Select value={templateForm.checklist_type} onValueChange={v => setTemplateForm(f => ({ ...f, checklist_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="offboarding">Offboarding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Checklist Items (one per line)</Label><Textarea value={templateForm.items} onChange={e => setTemplateForm(f => ({ ...f, items: e.target.value }))} rows={6} placeholder="Complete I-9 form&#10;Set up email account&#10;Issue laptop&#10;..." /></div>
                  <Button className="w-full" onClick={handleCreateTemplate} disabled={!templateForm.name}>Create Template</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active ({assignments?.filter(a => a.status !== "completed").length || 0})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({assignments?.filter(a => a.status === "completed").length || 0})</TabsTrigger>
            <TabsTrigger value="templates">Templates ({checklists?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 mt-4">
            {assignments?.filter(a => a.status !== "completed").map(a => (
              <Card key={a.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-sm">{(a as any).staff_profiles?.first_name} {(a as any).staff_profiles?.last_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{(a as any).hr_checklists?.name} · Assigned {format(new Date(a.assigned_at), "MMM d, yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === "in_progress" ? "default" : "secondary"}>{a.status}</Badge>
                    <span className="text-xs text-muted-foreground">{getProgress(a)}%</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={getProgress(a)} className="mb-3 h-2" />
                  <div className="space-y-2">
                    {(((a as any).hr_checklists?.items || []) as any[]).map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <Checkbox
                          checked={!!(a.item_statuses as Record<string, boolean>)?.[String(i)]}
                          onCheckedChange={() => toggleItem(a.id, i, (a.item_statuses || {}) as Record<string, boolean>)}
                        />
                        <span className="text-sm">{typeof item === "string" ? item : item.text}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!assignments?.filter(a => a.status !== "completed").length && (
              <p className="text-center py-8 text-muted-foreground">No active checklists</p>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-4">
            {assignments?.filter(a => a.status === "completed").map(a => (
              <Card key={a.id}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{(a as any).staff_profiles?.first_name} {(a as any).staff_profiles?.last_name}</p>
                    <p className="text-xs text-muted-foreground">{(a as any).hr_checklists?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-muted-foreground">{a.completed_at ? format(new Date(a.completed_at), "MMM d, yyyy") : "—"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4 mt-4">
            {checklists?.map(c => (
              <Card key={c.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.checklist_type} · {(c.items as any[]).length} items</p>
                    </div>
                    <Badge variant="outline">{c.checklist_type}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
