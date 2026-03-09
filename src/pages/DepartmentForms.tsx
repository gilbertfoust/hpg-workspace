import { useState } from "react";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { useDepartmentFormTemplates, useDepartmentFormSubmissions } from "@/hooks/useDepartmentForms";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, FolderOpen } from "lucide-react";
import { format } from "date-fns";

const DepartmentForms = () => {
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedSubDepartment, setSelectedSubDepartment] = useState<string | null>(null);
  
  const { data: orgUnits, isLoading: loadingOrgUnits } = useOrgUnits();
  const { data: templates, isLoading: loadingTemplates } = useDepartmentFormTemplates(
    selectedDepartment,
    selectedSubDepartment
  );
  const { data: submissions, isLoading: loadingSubmissions } = useDepartmentFormSubmissions(
    selectedDepartment,
    selectedSubDepartment
  );

  // Get unique departments
  const departments = orgUnits
    ? [...new Set(orgUnits.map(ou => ou.department_name))]
    : [];

  // Get sub-departments for selected department
  const subDepartments = orgUnits
    ? orgUnits
        .filter(ou => ou.department_name === selectedDepartment && ou.sub_department_name)
        .map(ou => ou.sub_department_name!)
    : [];

  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
    setSelectedSubDepartment(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
      draft: "secondary",
      submitted: "default",
      accepted: "success",
      rejected: "destructive",
      in_review: "warning",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Department Forms Repository</h1>
            <p className="text-muted-foreground">
              View and manage forms created by and sent to your department
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Department</CardTitle>
            <CardDescription>
              Choose a department to view its form templates and submissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <Select value={selectedDepartment} onValueChange={handleDepartmentChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingOrgUnits ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      departments.map(dept => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {subDepartments.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sub-Department (Optional)</label>
                  <Select 
                    value={selectedSubDepartment || "none"} 
                    onValueChange={(value) => setSelectedSubDepartment(value === "none" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All sub-departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All sub-departments</SelectItem>
                      {subDepartments.map(subDept => (
                        <SelectItem key={subDept} value={subDept}>
                          {subDept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedDepartment && (
          <Tabs defaultValue="templates" className="space-y-4">
            <TabsList>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Form Templates
              </TabsTrigger>
              <TabsTrigger value="submissions" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Form Submissions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="templates">
              <Card>
                <CardHeader>
                  <CardTitle>Form Templates</CardTitle>
                  <CardDescription>
                    Templates created for this department
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : templates && templates.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Template Name</TableHead>
                          <TableHead>Module</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.map((template: any) => (
                          <TableRow key={template.id}>
                            <TableCell className="font-medium">{template.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{template.module}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {template.description || "—"}
                            </TableCell>
                            <TableCell>{template.version || 1}</TableCell>
                            <TableCell>
                              {format(new Date(template.created_at), "PPp")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No templates found for this department
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="submissions">
              <Card>
                <CardHeader>
                  <CardTitle>Form Submissions</CardTitle>
                  <CardDescription>
                    Forms submitted to this department
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSubmissions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : submissions && submissions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Template</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Last Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissions.map((submission: any) => (
                          <TableRow key={submission.id}>
                            <TableCell className="font-medium">
                              {submission.form_template?.name || "Unknown"}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(submission.submission_status || "draft")}
                            </TableCell>
                            <TableCell>
                              {submission.submitted_at
                                ? format(new Date(submission.submitted_at), "PPp")
                                : "Not submitted"}
                            </TableCell>
                            <TableCell>
                              {format(new Date(submission.updated_at), "PPp")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No submissions found for this department
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
};

export default DepartmentForms;
