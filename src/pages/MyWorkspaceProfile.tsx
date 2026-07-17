import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Camera, Clock3, FileUp, ListTodo, Loader2, Save, Target } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentProfile, useUpdateMyProfile, useUpdateProfileAvatar } from "@/hooks/useProfiles";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "pt", label: "Português" },
  { value: "ar", label: "العربية" },
  { value: "sw", label: "Kiswahili" },
  { value: "bn", label: "বাংলা" },
];

interface StaffDashboardSnapshot {
  profile?: Record<string, unknown>;
  work?: {
    open?: number;
    overdue?: number;
    due_soon?: number;
    completed_30_days?: number;
    created_30_days?: number;
    completion_rate_30_days?: number;
  };
  hr?: { staff_profile_id?: string | null; hours_current_month?: number };
  documents?: { uploaded?: number };
}

interface StaffDashboardRpcClient {
  rpc: (name: "get_my_staff_dashboard") => Promise<{
    data: unknown;
    error: Error | null;
  }>;
}

export default function MyWorkspaceProfile() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useCurrentProfile();
  const { data: orgUnits = [] } = useOrgUnits();
  const updateProfile = useUpdateMyProfile();
  const updateAvatar = useUpdateProfileAvatar();
  const { toast } = useToast();
  const [form, setForm] = useState({
    full_name: "",
    job_title: "",
    phone: "",
    country_code: "",
    timezone: "UTC",
    preferred_language: "en",
    bio: "",
  });

  const dashboard = useQuery({
    queryKey: ["my-staff-dashboard", user?.id],
    enabled: !!user?.id && !!supabase,
    queryFn: async () => {
      const client = supabase as unknown as StaffDashboardRpcClient;
      const { data, error } = await client.rpc("get_my_staff_dashboard");
      if (error) throw error;
      return data as StaffDashboardSnapshot;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || "",
      job_title: profile.job_title || "",
      phone: profile.phone || "",
      country_code: profile.country_code || "",
      timezone: profile.timezone || "UTC",
      preferred_language: profile.preferred_language || "en",
      bio: profile.bio || "",
    });
  }, [profile]);

  const departmentName = useMemo(
    () => orgUnits.find((unit) => unit.id === profile?.department_id)?.department_name || "Not assigned",
    [orgUnits, profile?.department_id],
  );

  const handleAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Choose an image file" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Photo is larger than 5 MB" });
      return;
    }
    await updateAvatar.mutateAsync({ userId: user.id, file });
  };

  const handleSave = async () => {
    if (!user?.id) return;
    await updateProfile.mutateAsync({
      id: user.id,
      full_name: form.full_name.trim() || null,
      job_title: form.job_title.trim() || null,
      phone: form.phone.trim() || null,
      country_code: form.country_code.trim().toUpperCase() || null,
      timezone: form.timezone,
      preferred_language: form.preferred_language,
      bio: form.bio.trim() || null,
    });
  };

  const work = dashboard.data?.work || {};
  const metrics = [
    { label: "Open work", value: work.open ?? 0, icon: ListTodo, href: "/my-queue" },
    { label: "Due in 7 days", value: work.due_soon ?? 0, icon: Clock3, href: "/my-queue" },
    { label: "Overdue", value: work.overdue ?? 0, icon: Clock3, href: "/my-queue" },
    { label: "30-day progress", value: `${work.completion_rate_30_days ?? 0}%`, icon: Target, href: "/my-queue" },
    { label: "Hours this month", value: dashboard.data?.hr?.hours_current_month ?? 0, icon: Clock3, href: "/erp/hr" },
    { label: "Documents uploaded", value: dashboard.data?.documents?.uploaded ?? 0, icon: FileUp, href: "/documents" },
  ];

  return (
    <MainLayout title="My Workspace" subtitle="Your profile, workload, HR time, progress, documents, and deadlines">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {metrics.map((metric) => (
            <Link key={metric.label} to={metric.href}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="p-4">
                  <metric.icon className="h-4 w-4 text-muted-foreground" />
                  <p className="mt-3 text-2xl font-semibold">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>This photo appears anywhere your work is assigned.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="mx-auto w-fit">
                <UserAvatar
                  name={profile?.full_name}
                  email={profile?.email || user?.email}
                  avatarUrl={profile?.avatar_url}
                  className="h-24 w-24 text-2xl"
                />
              </div>
              <Label htmlFor="profile-photo" className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                {updateAvatar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Add or change photo
              </Label>
              <Input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatar} />
              <div className="space-y-2 text-left">
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="text-sm font-medium">{departmentName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Account role</p>
                  <Badge variant="outline" className="mt-1 capitalize">{profile?.role?.replace(/_/g, " ") || "Unassigned"}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Employment</p>
                  <p className="text-sm capitalize">{profile?.employment_status || "active"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile settings</CardTitle>
              <CardDescription>Authorization fields such as department and role are controlled by an administrator.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full-name">Full name</Label>
                <Input id="full-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-title">Job title</Label>
                <Input id="job-title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country code</Label>
                <Input id="country" maxLength={2} placeholder="US" value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={form.preferred_language} onValueChange={(value) => setForm({ ...form, preferred_language: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{languages.map((language) => <SelectItem key={language.value} value={language.value}>{language.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" placeholder="America/Detroit" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bio">About</Label>
                <Textarea id="bio" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </div>
              <div className="flex justify-end md:col-span-2">
                <Button onClick={handleSave} disabled={isLoading || updateProfile.isPending || !form.full_name.trim()}>
                  {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
