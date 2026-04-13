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
import { Check, Clock, Loader2, UserCheck, UserX, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ALL_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin_pm', label: 'Admin PM' },
  { value: 'executive_secretariat', label: 'Executive Secretariat' },
  { value: 'ngo_coordinator', label: 'NGO Coordinator' },
  { value: 'department_lead', label: 'Department Lead' },
  { value: 'staff_member', label: 'Staff Member' },
  { value: 'external_ngo', label: 'External NGO Portal' },
];

export default function PendingApprovalsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [rejectUser, setRejectUser] = useState<{ id: string; name: string | null } | null>(null);

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ['admin', 'pending-approvals'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('approval_status', 'pending')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!supabase,
  });

  const handleApprove = async (userId: string) => {
    setProcessingId(userId);
    try {
      const role = selectedRoles[userId] || 'staff_member';
      const { data, error } = await supabase!.functions.invoke('admin-approve-user', {
        body: { target_user_id: userId, action: 'approve', role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'User approved', description: 'The user has been approved and notified via email.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to approve user', description: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setProcessingId(userId);
    try {
      const { data, error } = await supabase!.functions.invoke('admin-approve-user', {
        body: { target_user_id: userId, action: 'reject' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'User rejected', description: 'The signup request has been rejected.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setRejectUser(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to reject user', description: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = pendingUsers?.length || 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Pending Approvals
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-2">{pendingCount}</Badge>
                )}
              </CardTitle>
              <CardDescription>Review and approve new user sign-up requests</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pendingCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Check className="h-8 w-8 text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">No pending approval requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingUsers!.map((user) => {
                const isProcessing = processingId === user.id;
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{user.full_name || 'No name'}</p>
                        <Badge variant="outline" className="gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          Pending
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{user.email || 'No email'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Signed up {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 ml-4">
                      <Select
                        value={selectedRoles[user.id] || 'staff_member'}
                        onValueChange={(val) =>
                          setSelectedRoles((prev) => ({ ...prev, [user.id]: val }))
                        }
                        disabled={isProcessing}
                      >
                        <SelectTrigger className="w-[160px] h-8">
                          <SelectValue placeholder="Assign role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        onClick={() => handleApprove(user.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRejectUser({ id: user.id, name: user.full_name })}
                        disabled={isProcessing}
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!rejectUser} onOpenChange={(open) => !open && setRejectUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reject the sign-up request from {rejectUser?.name || 'this user'}. They will not be able to access the workstation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectUser && handleReject(rejectUser.id)}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
