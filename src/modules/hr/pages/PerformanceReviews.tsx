import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePerformanceReviews } from "@/hooks/usePerformanceReviews";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { useInternalUsers } from "@/hooks/useProfiles";
import { Star, Plus } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  acknowledged: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function PerformanceReviews() {
  const { data: reviews, create, update } = usePerformanceReviews();
  const { data: staff } = useStaffProfiles({ status: "active" });
  const { data: users } = useInternalUsers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ staff_id: "", reviewer_user_id: "", review_period_start: "", review_period_end: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});

  const selectedReview = reviews?.find(r => r.id === selected);

  const handleCreate = () => {
    if (!form.staff_id || !form.review_period_start || !form.review_period_end) return;
    const staffMember = staff?.find(s => s.id === form.staff_id);
    create.mutate({
      staff_id: form.staff_id,
      ngo_id: staffMember?.ngo_id || undefined,
      reviewer_user_id: form.reviewer_user_id || undefined,
      review_period_start: form.review_period_start,
      review_period_end: form.review_period_end,
    }, { onSuccess: () => { setDialogOpen(false); setForm({ staff_id: "", reviewer_user_id: "", review_period_start: "", review_period_end: "" }); } });
  };

  const openReview = (review: any) => {
    setSelected(review.id);
    setEditForm({
      overall_rating: review.overall_rating || "",
      strengths: review.strengths || "",
      areas_for_improvement: review.areas_for_improvement || "",
      reviewer_comments: review.reviewer_comments || "",
      staff_comments: review.staff_comments || "",
    });
  };

  const saveReview = () => {
    if (!selected) return;
    update.mutate({ id: selected, ...editForm, overall_rating: editForm.overall_rating ? Number(editForm.overall_rating) : null }, { onSuccess: () => setSelected(null) });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="h-6 w-6" />Performance Reviews</h1>
            <p className="text-muted-foreground">Employee review cycles and evaluations</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Review</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Performance Review</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Employee *</Label>
                  <Select value={form.staff_id} onValueChange={v => setForm(f => ({ ...f, staff_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reviewer</Label>
                  <Select value={form.reviewer_user_id} onValueChange={v => setForm(f => ({ ...f, reviewer_user_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{users?.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Period Start *</Label><Input type="date" value={form.review_period_start} onChange={e => setForm(f => ({ ...f, review_period_start: e.target.value }))} /></div>
                  <div><Label>Period End *</Label><Input type="date" value={form.review_period_end} onChange={e => setForm(f => ({ ...f, review_period_end: e.target.value }))} /></div>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={!form.staff_id || !form.review_period_start || !form.review_period_end}>Create Review</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!reviews?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No reviews</TableCell></TableRow>
                ) : reviews.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openReview(r)}>
                    <TableCell className="font-medium">{(r as any).staff_profiles?.first_name} {(r as any).staff_profiles?.last_name}</TableCell>
                    <TableCell className="text-sm">{(r as any).profiles?.full_name || "—"}</TableCell>
                    <TableCell className="text-sm">{format(new Date(r.review_period_start), "MMM yyyy")} – {format(new Date(r.review_period_end), "MMM yyyy")}</TableCell>
                    <TableCell>
                      {r.overall_rating ? (
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star key={n} className={`h-3 w-3 ${n <= r.overall_rating! ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                          ))}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell><Badge className={STATUS_COLORS[r.status] ?? ""}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Sheet open={!!selected} onOpenChange={open => !open && setSelected(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader><SheetTitle>Review Details</SheetTitle></SheetHeader>
            {selectedReview && (
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Overall Rating (1-5)</Label>
                  <div className="flex gap-2 mt-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setEditForm(f => ({ ...f, overall_rating: n }))} className="p-1">
                        <Star className={`h-6 w-6 ${n <= Number(editForm.overall_rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div><Label>Strengths</Label><Textarea value={String(editForm.strengths || "")} onChange={e => setEditForm(f => ({ ...f, strengths: e.target.value }))} rows={3} /></div>
                <div><Label>Areas for Improvement</Label><Textarea value={String(editForm.areas_for_improvement || "")} onChange={e => setEditForm(f => ({ ...f, areas_for_improvement: e.target.value }))} rows={3} /></div>
                <div><Label>Reviewer Comments</Label><Textarea value={String(editForm.reviewer_comments || "")} onChange={e => setEditForm(f => ({ ...f, reviewer_comments: e.target.value }))} rows={3} /></div>
                <div><Label>Staff Comments</Label><Textarea value={String(editForm.staff_comments || "")} onChange={e => setEditForm(f => ({ ...f, staff_comments: e.target.value }))} rows={3} /></div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={saveReview}>Save</Button>
                  {selectedReview.status === "draft" && (
                    <Button variant="outline" onClick={() => update.mutate({ id: selected!, status: "submitted" }, { onSuccess: () => setSelected(null) })}>Submit</Button>
                  )}
                  {selectedReview.status === "submitted" && (
                    <Button variant="outline" onClick={() => update.mutate({ id: selected!, status: "acknowledged" }, { onSuccess: () => setSelected(null) })}>Acknowledge</Button>
                  )}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </MainLayout>
  );
}
