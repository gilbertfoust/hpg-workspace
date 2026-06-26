import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Check,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  Shield,
  Trash2,
  UserCog,
} from 'lucide-react';
import { useAdminUsers, useDeleteAdminUser } from '@/hooks/useAdminUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import CreateUserDialog from '@/components/admin/CreateUserDialog';
import AssignNgoDialog from '@/components/admin/AssignNgoDialog';
import ResetPasswordDialog from '@/components/admin/ResetPasswordDialog';
import { ADMIN_ASSIGNABLE_ROLES } from '@/lib/accessControl';
import { invokeAdminFunction } from '@/lib/invokeAdminFunction';

const ALL_ROLES = ADMIN_ASSIGNABLE_ROLES;

const roleColors: Record<string, string> = {
  super_admin: 'bg-destructive/10 text-destructive',
  admin_pm: 'bg-blue-500/10 text-blue-600',
  ngo_coordinator: 'bg-green-500/10 text-green-600',
  department_lead: 'bg-amber-500/10 text-amber-600',
  staff_member: 'bg-muted text-muted-foreground',
  staff: 'bg-muted text-muted-foreground',
  executive_secretariat: 'bg-purple-500/10 text-purple-600',
  external_ngo: 'bg-cyan-500/10 text-cyan-600',
  ngo_user: 'bg-cyan-500/10 text-cyan-600',
};

const formatRoleName = (role: string) =>
  ALL_ROLES.find((entry) => entry.value === role)?.label ||
  role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export default function UsersManager() {
  const { data: users, isLoading, error } = useAdminUsers();
  const { user: currentUser } = useAuth();
  const { data: currentUserRole } = useUserRole();
  const deleteUserMutation = useDeleteAdminUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string | null; email: string | null } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string | null } | null>(null);
  const [assignNgoUser, setAssignNgoUser] = useState<{ id: string; name: string } | null>(null);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);

  const isSuperAdmin = currentUserRole?.role === 'super_admin' || currentUserRole?.role === 'admin_pm';

  const handleRoleChange = async (userId: string, newRole: string) => {
    setChangingRoleUserId(userId);
    try {
      await invokeAdminFunction('admin-update-role', {
        target_user_id: userId,
        new_role: newRole,
      });
      toast({ title: 'Role updated', description: `Role changed to ${formatRoleName(newRole)}.` });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Failed to update role',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setChangingRoleUserId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="w-5 h-5" />
                User Management
              </CardTitle>
              <CardDescription>Create accounts, assign roles, and manage access</CardDescription>
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
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Shield className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Unable to load users'}
              </p>
            </div>
          ) : (
            <div className="data-table">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    {isSuperAdmin && <th className="w-10">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users && users.length > 0 ? (
                    users.map((user) => {
                      const primaryRole = user.roles[0] || 'staff_member';
                      const isCurrentUser = user.id === currentUser?.id;
                      const isChangingRole = changingRoleUserId === user.id;
                      return (
                        <tr key={user.id}>
                          <td className="font-medium">{user.full_name || 'N/A'}</td>
                          <td className="text-muted-foreground text-sm">{user.email || 'N/A'}</td>
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
                                {isCurrentUser && ' (You)'}
                              </Badge>
                            )}
                          </td>
                          <td className="text-sm text-muted-foreground">—</td>
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
                                    onClick={() => setResetPasswordUser({ id: user.id, name: user.full_name })}
                                  >
                                    <KeyRound className="w-4 h-4 mr-2" />
                                    Reset Password
                                  </DropdownMenuItem>
                                  {!isCurrentUser && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setAssignNgoUser({
                                          id: user.id,
                                          name: user.full_name || user.email || 'User',
                                        })
                                      }
                                    >
                                      <Building2 className="w-4 h-4 mr-2" />
                                      Assign to NGO
                                    </DropdownMenuItem>
                                  )}
                                  {!isCurrentUser && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setUserToDelete({ id: user.id, name: user.full_name, email: user.email })}
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
                      <td colSpan={isSuperAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
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

      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <ResetPasswordDialog
        open={!!resetPasswordUser}
        onOpenChange={(open) => !open && setResetPasswordUser(null)}
        userId={resetPasswordUser?.id || ''}
        userName={resetPasswordUser?.name || ''}
      />
      {assignNgoUser && (
        <AssignNgoDialog
          open={!!assignNgoUser}
          onOpenChange={(open) => !open && setAssignNgoUser(null)}
          userId={assignNgoUser.id}
          userName={assignNgoUser.name}
        />
      )}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {userToDelete?.name || userToDelete?.email}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (userToDelete) { await deleteUserMutation.mutateAsync(userToDelete.id); setUserToDelete(null); } }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
