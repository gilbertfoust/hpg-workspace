import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfigCheckPanel from "@/components/admin/ConfigCheckPanel";
import CreateUserDialog from "@/components/admin/CreateUserDialog";
import ResetPasswordDialog from "@/components/admin/ResetPasswordDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Building,
  FileText,
  Settings,
  Shield,
  Database,
  Bell,
  Link,
  Plus,
  MoreHorizontal,
  Check,
  Trash2,
  Loader2,
  KeyRound,
  UserCog,
  Camera,
} from "lucide-react";
import { useAdminUsers, useDeleteAdminUser } from "@/hooks/useAdminUsers";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole, getRoleAccessLane } from "@/hooks/useUserRole";
import { useUpdateProfileAvatar } from "@/hooks/useProfiles";
import { UserAvatar } from "@/components/common/UserAvatar";
import {
  ADMIN_ASSIGNABLE_ROLES,
  canAssignRoles,
  getRoleLabel,
} from "@/lib/accessControl";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ALL_ROLES = ADMIN_ASSIGNABLE_ROLES;

const mockDepartments = [
  { id: "1", name: "Administration", subDepts: ["Executive Secretariat"], lead: "Jane Smith", items: 12 },
  { id: "2", name: "NGO Coordination", subDepts: [], lead: "Maria Garcia", items: 24 },
  { id: "3", name: "Finance", subDepts: [], lead: "Tom Wilson", items: 8 },
  { id: "4", name: "Legal", subDepts: ["Compliance"], lead: "Sarah Johnson", items: 5 },
  { id: "5", name: "Development", subDepts: ["Partnerships"], lead: "John Doe", items: 15 },
  { id: "6", name: "HR", subDepts: ["Recruiting"], lead: "Emily Brown", items: 6 },
  { id: "7", name: "IT", subDepts: [], lead: "David Kim", items: 10 },
  { id: "8", name: "Marketing", subDepts: ["Communications"], lead: "Lisa Chen", items: 7 },
  { id: "9", name: "Program", subDepts: ["Curriculum"], lead: "Michael Lee", items: 18 },
];

const roleColors: Record<string, string> = {
  super_admin: "bg-destructive/10 text-destructive",
  admin_pm: "bg-blue-500/10 text-blue-600",
  ngo_coordinator: "bg-green-500/10 text-green-600",
  department_lead: "bg-amber-500/10 text-amber-600",
  staff_member: "bg-muted text-muted-foreground",
  staff: "bg-muted text-muted-foreground",
  executive_secretariat: "bg-purple-500/10 text-purple-600",
  external_ngo: "bg-cyan-500/10 text-cyan-600",
};

const formatRoleName = (role: string) => getRoleLabel(role);

export default function Admin() {
  const { data: users, isLoading: usersLoading, error: usersError } = useAdminUsers();
  const { user: currentUser } = useAuth();
  const { data: currentUserRole } = useUserRole();
  const deleteUserMutation = useDeleteAdminUser();
  const updateAvatarMutation = useUpdateProfileAvatar();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string | null; email: string | null } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string | null } | null>(null);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [uploadingAvatarUserId, setUploadingAvatarUserId] = useState<string | null>(null);

  const canManageRoles = canAssignRoles(currentUserRole?.role);
  const isSuperAdmin = canManageRoles;

  const handleDeleteClick = (userId: string, userName: string | null, userEmail: string | null) => {
    setUserToDelete({ id: userId, name: userName, email: userEmail });
  };

  const handleDeleteConfirm = async () => {
    if (userToDelete) {
      await deleteUserMutation.mutateAsync(userToDelete.id);
      setUserToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setUserToDelete(null);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!canManageRoles) {
      toast({
        variant: "destructive",
        title: "Not authorized",
        description: "Only Super Admin and Admin users can assign access levels.",
      });
      return;
    }

    setChangingRoleUserId(userId);
    try {
      const { data, error } = await supabase!.functions.invoke("admin-update-role", {
        body: { target_user_id: userId, new_role: newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Role updated", description: `Role changed to ${formatRoleName(newRole)}.` });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to update role", description: err.message });
    } finally {
      setChangingRoleUserId(null);
    }
  };

  const handleAvatarUpload = async (userId: string, file: File) => {
    setUploadingAvatarUserId(userId);
    try {
      await updateAvatarMutation.mutateAsync({ userId, file });
    } finally {
      setUploadingAvatarUserId(null);
    }
  };

  return (
    <MainLayout
      title="Admin Console"
      subtitle="Manage users, roles, departments, and system configuration"
    >
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <Building className="w-4 h-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Link className="w-4 h-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="w-5 h-5" />
                    User Management
                  </CardTitle>
                  <CardDescription>Create accounts, assign roles, and manage access — like Google Workspace Admin</CardDescription>
                </div>
                {isSuperAdmin && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : usersError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Shield className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {usersError instanceof Error ? usersError.message : "Unable to load users"}
                  </p>
                </div>
              ) : (
                <div className="data-table">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="w-12">Photo</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Access level</th>
                        <th>Access lane</th>
                        <th>Status</th>
                        {isSuperAdmin && <th className="w-10">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {users && users.length > 0 ? (
                        users.map((user) => {
                          const primaryRole = user.roles[0] || "staff_member";
                          const isCurrentUser = user.id === currentUser?.id;
                          const isChangingRole = changingRoleUserId === user.id;
                          return (
                            <tr key={user.id}>
                              <td>
                                <div className="flex items-center gap-2">
                                  <UserAvatar
                                    name={user.full_name}
                                    email={user.email}
                                    avatarUrl={user.avatar_url}
                                  />
                                  {isSuperAdmin && (
                                    <label className="cursor-pointer">
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        className="hidden"
                                        disabled={uploadingAvatarUserId === user.id}
                                        onChange={(event) => {
                                          const file = event.target.files?.[0];
                                          if (file) handleAvatarUpload(user.id, file);
                                          event.currentTarget.value = "";
                                        }}
                                      />
                                      <Camera className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                    </label>
                                  )}
                                </div>
                              </td>
                              <td className="font-medium">{user.full_name || "N/A"}</td>
                              <td className="text-muted-foreground text-sm">{user.email || "N/A"}</td>
                              <td>
                                {isSuperAdmin && !isCurrentUser ? (
                                  <Select
                                    value={primaryRole}
                                    onValueChange={(val) => handleRoleChange(user.id, val)}
                                    disabled={isChangingRole}
                                  >
                                    <SelectTrigger className="w-[180px] h-8">
                                      {isChangingRole ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <SelectValue />
                                      )}
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ALL_ROLES.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                          {r.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge className={roleColors[primaryRole] || roleColors.staff_member}>
                                    {formatRoleName(primaryRole)}
                                    {isCurrentUser && " (You)"}
                                  </Badge>
                                )}
                              </td>
                              <td className="text-sm text-muted-foreground">
                                {getRoleAccessLane(primaryRole)}
                              </td>
                              <td>
                                <Badge variant="outline" className="gap-1">
                                  <Check className="w-3 h-3" />
                                  Active
                                </Badge>
                              </td>
                              {isSuperAdmin && (
                                <td>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setResetPasswordUser({ id: user.id, name: user.full_name })
                                        }
                                      >
                                        <KeyRound className="w-4 h-4 mr-2" />
                                        Reset Password
                                      </DropdownMenuItem>
                                      {!isCurrentUser && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() =>
                                              handleDeleteClick(user.id, user.full_name, user.email)
                                            }
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete User
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={isSuperAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">
                            No users found. Click "Add User" to create the first account.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Departments & Org Units</CardTitle>
                  <CardDescription>Configure department structure and leadership</CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Department
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockDepartments.map((dept) => (
                  <div key={dept.id} className="p-4 rounded-lg border hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">{dept.name}</h4>
                      <Badge variant="secondary">{dept.items} items</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Lead: {dept.lead}</p>
                    {dept.subDepts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {dept.subDepts.map((sub) => (
                          <Badge key={sub} variant="outline" className="text-xs">
                            {sub}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Work Item Templates</CardTitle>
                  <CardDescription>Configure templates for generating work items</CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Base Onboarding (Model C)", items: 12, group: "Onboarding" },
                  { name: "Monthly NGO Upkeep", items: 5, group: "Monthly Upkeep" },
                  { name: "Annual Compliance (Base)", items: 8, group: "Annual" },
                  { name: "Offboarding (Base)", items: 6, group: "Offboarding" },
                ].map((template) => (
                  <div key={template.name} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {template.items} work items • {template.group}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">Edit</Button>
                      <Button variant="outline" size="sm">Preview</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="w-5 h-5" />
                  Trello Integration
                </CardTitle>
                <CardDescription>Sync work items with Trello boards</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status</span>
                    <Badge className="bg-green-500/10 text-green-600">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last synced</span>
                    <span className="text-sm text-muted-foreground">5 minutes ago</span>
                  </div>
                  <Button variant="outline" className="w-full">Configure</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Email Notifications
                </CardTitle>
                <CardDescription>Configure email reminders and alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status</span>
                    <Badge className="bg-green-500/10 text-green-600">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Reminders sent today</span>
                    <span className="text-sm text-muted-foreground">12</span>
                  </div>
                  <Button variant="outline" className="w-full">Configure</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ConfigCheckPanel />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Two-factor authentication</p>
                      <p className="text-xs text-muted-foreground">Require 2FA for all users</p>
                    </div>
                    <Badge variant="outline">Optional</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Session timeout</p>
                      <p className="text-xs text-muted-foreground">Auto-logout after inactivity</p>
                    </div>
                    <Badge variant="secondary">30 min</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Data Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Audit log retention</p>
                      <p className="text-xs text-muted-foreground">How long to keep audit logs</p>
                    </div>
                    <Badge variant="secondary">1 year</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Timezone</p>
                      <p className="text-xs text-muted-foreground">Default system timezone</p>
                    </div>
                    <Badge variant="secondary">America/Toronto</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {/* Reset Password Dialog */}
      {resetPasswordUser && (
        <ResetPasswordDialog
          open={!!resetPasswordUser}
          onOpenChange={(open) => !open && setResetPasswordUser(null)}
          userId={resetPasswordUser.id}
          userName={resetPasswordUser.name}
        />
      )}

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={handleDeleteCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {userToDelete?.name || userToDelete?.email || "this user"}
              </strong>
              ? This action cannot be undone and will permanently delete the user's profile and roles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
