import { useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useProfiles, useUpdateProfileDepartment } from "@/hooks/useProfiles";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import {
  AppRole,
  useIsAdminUser,
  useUpdateUserRole,
  useUserRoles,
} from "@/hooks/useUserRole";

const roleOptions: { value: AppRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin_pm", label: "Admin PM" },
  { value: "department_lead", label: "Department Lead" },
  { value: "staff_member", label: "Staff" },
  { value: "ngo_coordinator", label: "NGO Coordinator" },
  { value: "executive_secretariat", label: "Executive Secretariat" },
  { value: "external_ngo", label: "External NGO" },
];

export default function AdminRoles() {
  const { data: profiles = [] } = useProfiles();
  const { data: userRoles = [] } = useUserRoles();
  const { data: orgUnits = [] } = useOrgUnits();
  const updateUserRole = useUpdateUserRole();
  const updateDepartment = useUpdateProfileDepartment();
  const isAdminUser = useIsAdminUser();

  const orgUnitById = useMemo(() => {
    return new Map(orgUnits.map((unit) => [unit.id, unit]));
  }, [orgUnits]);

  const departmentOptions = useMemo(() => {
    return [...new Set(orgUnits.map((unit) => unit.department_name))];
  }, [orgUnits]);

  const getDefaultOrgUnitId = (departmentName: string) => {
    const departmentUnits = orgUnits.filter((unit) => unit.department_name === departmentName);
    const topLevel = departmentUnits.find((unit) => unit.sub_department_name === null);
    return topLevel?.id ?? departmentUnits[0]?.id ?? null;
  };

  const getSubDepartmentOptions = (departmentName?: string) => {
    if (!departmentName) return [];
    return orgUnits.filter((unit) => unit.department_name === departmentName);
  };

  return (
    <MainLayout
      title="Roles & Departments"
      subtitle="Manage staff roles and department assignments"
    >
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Sub-department</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => {
                const role = userRoles.find((entry) => entry.user_id === profile.id)?.role;
                const orgUnit = profile.department_id ? orgUnitById.get(profile.department_id) : undefined;
                const departmentName = orgUnit?.department_name;
                const subDepartment = orgUnit?.sub_department_name;
                const departmentValue = departmentName ?? "unassigned";
                const subDepartmentValue = profile.department_id ?? "unassigned";

                return (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.full_name || "Unnamed"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile.email || "No email"}
                    </TableCell>
                    <TableCell>
                      {isAdminUser ? (
                        <Select
                          value={role ?? "staff_member"}
                          onValueChange={(value) =>
                            updateUserRole.mutate({ userId: profile.id, role: value as AppRole })
                          }
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">
                          {roleOptions.find((option) => option.value === (role ?? "staff_member"))?.label ??
                            "Staff"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isAdminUser ? (
                        <Select
                          value={departmentValue}
                          onValueChange={(value) => {
                            if (value === "unassigned") {
                              updateDepartment.mutate({ id: profile.id, departmentId: null });
                              return;
                            }
                            const defaultOrgUnitId = getDefaultOrgUnitId(value);
                            updateDepartment.mutate({
                              id: profile.id,
                              departmentId: defaultOrgUnitId,
                            });
                          }}
                        >
                          <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {departmentOptions.map((department) => (
                              <SelectItem key={department} value={department}>
                                {department}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{departmentName ?? "Unassigned"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isAdminUser ? (
                        <Select
                          value={subDepartmentValue}
                          disabled={!departmentName}
                          onValueChange={(value) => {
                            updateDepartment.mutate({ id: profile.id, departmentId: value });
                          }}
                        >
                          <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Select sub-department" />
                          </SelectTrigger>
                          <SelectContent>
                            {getSubDepartmentOptions(departmentName).map((unit) => (
                              <SelectItem key={unit.id} value={unit.id}>
                                {unit.sub_department_name ?? "General"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{subDepartment ?? "General"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
