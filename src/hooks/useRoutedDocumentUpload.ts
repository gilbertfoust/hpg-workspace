import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { DocumentCategory } from "@/hooks/useDocuments";
import type { ModuleType } from "@/hooks/useWorkItems";
import { getDepartmentIdForModule } from "@/utils/moduleToDepartment";
import {
  buildUploadWorkItemDescription,
  buildUploadWorkItemTitle,
  getUploadRouteConfig,
  resolveModuleForDepartment,
  type UploadRouteType,
} from "@/lib/uploadRouting";
import { queueUploadNotification } from "@/lib/uploadNotifications";

const BUCKET_NAME = "ngo-documents";

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export interface RoutedUploadInput {
  file: File;
  routeType: UploadRouteType;
  ngoId?: string;
  departmentId?: string;
  departmentName?: string;
  ngoName?: string;
}

export interface RoutedUploadResult {
  documentId: string;
  workItemId: string;
  routedTo: string;
  notificationMessage: string;
}

export const useRoutedDocumentUpload = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: RoutedUploadInput): Promise<RoutedUploadResult> => {
      ensureSupabase();
      const routeConfig = getUploadRouteConfig(input.routeType);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to upload documents");

      let module: ModuleType = routeConfig.module;
      let departmentId = input.departmentId ?? null;
      let category: DocumentCategory = routeConfig.category;
      let storagePrefix = "internal/general";

      if (input.routeType === "internal_department") {
        if (!input.departmentId) {
          throw new Error("Select a department for internal uploads.");
        }
        departmentId = input.departmentId;
        module = resolveModuleForDepartment(input.departmentName, routeConfig.module);
        storagePrefix = `internal/${input.departmentId}`;
      } else if (input.routeType === "ngo_upload") {
        if (!input.ngoId) {
          throw new Error("Select an NGO for NGO uploads.");
        }
        departmentId = await getDepartmentIdForModule("ngo_coordination");
        storagePrefix = input.ngoId;
      } else {
        departmentId = await getDepartmentIdForModule(module);
        storagePrefix = `internal/${module}`;
      }

      const timestamp = Date.now();
      const sanitizedFileName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${storagePrefix}/${timestamp}_${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, input.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: input.file.type || "application/octet-stream",
        });

      if (uploadError) throw uploadError;

      const routedTo = routeConfig.coordinatorLabel;

      const { data: workItem, error: workItemError } = await supabase
        .from("work_items")
        .insert({
          title: buildUploadWorkItemTitle(input.file.name, routeConfig.label),
          description: buildUploadWorkItemDescription({
            routeType: input.routeType,
            fileName: input.file.name,
            routedTo,
            ngoName: input.ngoName,
          }),
          status: "not_started",
          module,
          department_id: departmentId,
          ngo_id: input.ngoId ?? null,
          type: "document_upload",
          evidence_required: false,
          created_by_user_id: user.id,
        } as never)
        .select()
        .single();

      if (workItemError) {
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        throw workItemError;
      }

      const { data: document, error: documentError } = await supabase
        .from("documents")
        .insert({
          file_name: input.file.name,
          file_path: filePath,
          file_type: input.file.type || "application/octet-stream",
          file_size: input.file.size,
          category,
          ngo_id: input.ngoId ?? null,
          work_item_id: workItem.id,
          uploaded_by_user_id: user.id,
          review_status: "Pending",
        })
        .select()
        .single();

      if (documentError) {
        await supabase.from("work_items").delete().eq("id", workItem.id);
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        throw documentError;
      }

      const notification = await queueUploadNotification({
        workItemId: workItem.id,
        documentId: document.id,
        module,
        departmentId,
      });

      return {
        documentId: document.id,
        workItemId: workItem.id,
        routedTo,
        notificationMessage: notification.message,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      toast({
        title: "Upload routed",
        description: `Sent to ${result.routedTo}. ${result.notificationMessage}`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    },
  });
};
