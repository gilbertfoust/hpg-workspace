import { useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, File, X, Loader2, Route } from "lucide-react";
import { useNGOs } from "@/hooks/useNGOs";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { useRoutedDocumentUpload } from "@/hooks/useRoutedDocumentUpload";
import {
  getUploadRouteConfig,
  UPLOAD_ROUTE_OPTIONS,
  type UploadRouteType,
} from "@/lib/uploadRouting";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const acceptedFileTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
].join(",");

export function DocumentUploadDialog({ open, onOpenChange }: DocumentUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [routeType, setRouteType] = useState<UploadRouteType>("ngo_upload");
  const [selectedNgoId, setSelectedNgoId] = useState<string>("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useRoutedDocumentUpload();
  const { data: ngos, isLoading: ngosLoading } = useNGOs();
  const { data: orgUnits, isLoading: orgUnitsLoading } = useOrgUnits();

  const routeConfig = getUploadRouteConfig(routeType);

  const selectedDepartment = useMemo(
    () => orgUnits?.find((unit) => unit.id === selectedDepartmentId),
    [orgUnits, selectedDepartmentId]
  );

  const selectedNgo = useMemo(
    () => ngos?.find((ngo) => ngo.id === selectedNgoId),
    [ngos, selectedNgoId]
  );

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    if (routeConfig.requiresNgo && !selectedNgoId) return;
    if (routeConfig.requiresDepartment && !selectedDepartmentId) return;

    try {
      await uploadMutation.mutateAsync({
        file: selectedFile,
        routeType,
        ngoId: routeConfig.requiresNgo ? selectedNgoId : undefined,
        departmentId: routeConfig.requiresDepartment ? selectedDepartmentId : undefined,
        departmentName: selectedDepartment?.department_name,
        ngoName: selectedNgo ? selectedNgo.common_name || selectedNgo.legal_name : undefined,
      });

      setSelectedFile(null);
      setRouteType("ngo_upload");
      setSelectedNgoId("");
      setSelectedDepartmentId("");
      onOpenChange(false);
    } catch {
      // handled by mutation
    }
  };

  const handleClose = () => {
    if (!uploadMutation.isPending) {
      setSelectedFile(null);
      setRouteType("ngo_upload");
      setSelectedNgoId("");
      setSelectedDepartmentId("");
      onOpenChange(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canSubmit =
    !!selectedFile &&
    (!routeConfig.requiresNgo || !!selectedNgoId) &&
    (!routeConfig.requiresDepartment || !!selectedDepartmentId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Choose an upload route so files land in the right inbox. NGO uploads go to the NGO Coordinator;
            internal uploads go to the selected department.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="upload-route">Upload route *</Label>
            <Select value={routeType} onValueChange={(v) => setRouteType(v as UploadRouteType)}>
              <SelectTrigger id="upload-route">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPLOAD_ROUTE_OPTIONS.map(({ value, config }) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Route className="w-3 h-3" />
              Routes to {routeConfig.coordinatorLabel}
            </p>
          </div>

          {routeConfig.requiresNgo && (
            <div className="space-y-2">
              <Label htmlFor="ngo">NGO *</Label>
              <Select value={selectedNgoId} onValueChange={setSelectedNgoId} disabled={ngosLoading}>
                <SelectTrigger id="ngo">
                  <SelectValue placeholder={ngosLoading ? "Loading NGOs..." : "Select an NGO"} />
                </SelectTrigger>
                <SelectContent>
                  {ngos?.map((ngo) => (
                    <SelectItem key={ngo.id} value={ngo.id}>
                      {ngo.common_name || ngo.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {routeConfig.requiresDepartment && (
            <div className="space-y-2">
              <Label htmlFor="department">Receiving department *</Label>
              <Select
                value={selectedDepartmentId}
                onValueChange={setSelectedDepartmentId}
                disabled={orgUnitsLoading}
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder={orgUnitsLoading ? "Loading departments..." : "Select department"} />
                </SelectTrigger>
                <SelectContent>
                  {orgUnits?.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.department_name}
                      {unit.sub_department_name ? ` — ${unit.sub_department_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5"
                : selectedFile
                  ? "border-primary/50 bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileSelect(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <label htmlFor="file-upload" className="sr-only">
              Select file to upload
            </label>
            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={acceptedFileTypes}
              onChange={(e) => handleFileSelect(e.target.files)}
              title="Select file to upload"
            />

            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <File className="w-8 h-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-sm truncate max-w-[200px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Drop a file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Max file size: 50MB</p>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploadMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || uploadMutation.isPending}>
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload & route
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
