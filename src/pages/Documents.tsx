import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Upload,
  Filter,
  MoreHorizontal,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

// Mock data
const mockDocuments = [
  {
    id: "1",
    fileName: "Q4_Financial_Report_2025.pdf",
    fileType: "pdf",
    category: "Finance",
    ngo: "Detroit Community Foundation",
    uploadedBy: "Jane Smith",
    uploadedAt: "2026-01-10",
    fileSize: "2.4 MB",
    reviewStatus: "pending",
    workItem: "WI-001",
  },
  {
    id: "2",
    fileName: "Onboarding_Checklist_CYI.xlsx",
    fileType: "xlsx",
    category: "Onboarding",
    ngo: "Chicago Youth Initiative",
    uploadedBy: "John Doe",
    uploadedAt: "2026-01-09",
    fileSize: "156 KB",
    reviewStatus: "approved",
    workItem: "WI-002",
  },
  {
    id: "3",
    fileName: "Grant_Application_Ford.docx",
    fileType: "docx",
    category: "Development",
    ngo: "Mexican Education Alliance",
    uploadedBy: "Maria Garcia",
    uploadedAt: "2026-01-08",
    fileSize: "1.1 MB",
    reviewStatus: "pending",
    workItem: "WI-003",
  },
  {
    id: "4",
    fileName: "Tax_Exemption_Certificate.pdf",
    fileType: "pdf",
    category: "Compliance",
    ngo: "African Youth Network",
    uploadedBy: "David Okonkwo",
    uploadedAt: "2026-01-05",
    fileSize: "890 KB",
    reviewStatus: "approved",
    workItem: null,
  },
  {
    id: "5",
    fileName: "Program_Photos_Dec2025.zip",
    fileType: "zip",
    category: "Program",
    ngo: "Asian Development Partners",
    uploadedBy: "Sarah Lee",
    uploadedAt: "2026-01-03",
    fileSize: "45.2 MB",
    reviewStatus: "rejected",
    workItem: null,
  },
];

const categories = ["All Categories", "Onboarding", "Compliance", "Finance", "HR", "Marketing", "Program", "Legal", "Development"];

const FileIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "pdf":
      return <FileText className="w-5 h-5 text-red-500" />;
    case "xlsx":
    case "xls":
      return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    case "docx":
    case "doc":
      return <FileText className="w-5 h-5 text-blue-500" />;
    case "png":
    case "jpg":
    case "jpeg":
      return <FileImage className="w-5 h-5 text-purple-500" />;
    default:
      return <File className="w-5 h-5 text-muted-foreground" />;
  }
};

const ReviewStatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-success/10 text-success hover:bg-success/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-warning/10 text-warning hover:bg-warning/20">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return null;
  }
};

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");

  return (
    <MainLayout
      title="Documents"
      subtitle="Manage and review all uploaded files and evidence"
      actions={
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      }
    >
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Documents Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="data-table overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>File</th>
                <th>Category</th>
                <th>NGO</th>
                <th>Uploaded By</th>
                <th>Date</th>
                <th>Size</th>
                <th>Review Status</th>
                <th>Work Item</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {mockDocuments.map((doc) => (
                <tr key={doc.id} className="group cursor-pointer">
                  <td>
                    <div className="flex items-center gap-3">
                      <FileIcon type={doc.fileType} />
                      <span className="font-medium">{doc.fileName}</span>
                    </div>
                  </td>
                  <td>
                    <Badge variant="outline" className="text-xs font-normal">
                      {doc.category}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground">{doc.ngo}</td>
                  <td className="text-muted-foreground">{doc.uploadedBy}</td>
                  <td className="text-muted-foreground whitespace-nowrap">{doc.uploadedAt}</td>
                  <td className="text-muted-foreground">{doc.fileSize}</td>
                  <td>
                    <ReviewStatusBadge status={doc.reviewStatus} />
                  </td>
                  <td className="text-muted-foreground font-mono text-xs">
                    {doc.workItem || "—"}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>Showing {mockDocuments.length} of {mockDocuments.length} documents</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
