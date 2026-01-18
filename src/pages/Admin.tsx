import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfigCheckPanel from "@/components/admin/ConfigCheckPanel";
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
} from "lucide-react";

// Mock data
const mockUsers = [
  { id: "1", name: "Jane Smith", email: "jane@hpg.org", role: "Super Admin", status: "active" },
  { id: "2", name: "John Doe", email: "john@hpg.org", role: "Admin PM", status: "active" },
  { id: "3", name: "Maria Garcia", email: "maria@hpg.org", role: "NGO Coordinator", status: "active" },
  { id: "4", name: "David Kim", email: "david@hpg.org", role: "Department Lead", status: "active" },
  { id: "5", name: "Sarah Johnson", email: "sarah@hpg.org", role: "Staff Member", status: "active" },
];

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
  "Super Admin": "bg-destructive/10 text-destructive",
  "Admin PM": "bg-info/10 text-info",
  "NGO Coordinator": "bg-success/10 text-success",
  "Department Lead": "bg-warning/10 text-warning",
  "Staff Member": "bg-muted text-muted-foreground",
};

export default function Admin() {
  return (
    <MainLayout
      title="Admin Settings"
      subtitle="Manage users, departments, templates, and system configuration"
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
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Manage staff accounts and role assignments</CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="data-table">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="font-medium">{user.name}</td>
                        <td className="text-muted-foreground">{user.email}</td>
                        <td>
                          <Badge className={roleColors[user.role]}>{user.role}</Badge>
                        </td>
                        <td>
                          <Badge variant="outline" className="gap-1">
                            <Check className="w-3 h-3" />
                            Active
                          </Badge>
                        </td>
                        <td>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    <Badge className="bg-success/10 text-success">Connected</Badge>
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
                    <Badge className="bg-success/10 text-success">Enabled</Badge>
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
            {/* Config Check Panel */}
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
    </MainLayout>
  );
}
