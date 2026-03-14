import type { Json } from "@/integrations/supabase/types";
import type { FormField } from "@/hooks/useFormTemplates";
import type { ModuleType } from "@/hooks/useWorkItems";

export interface FormTemplateSeed {
  name: string;
  module: ModuleType;
  description: string;
  schema_json: {
    fields: FormField[];
  };
  mapping_json?: Json;
}

export const monthlyCheckInTemplate: FormTemplateSeed = {
  name: "Monthly NGO Check-in",
  module: "ngo_coordination",
  description: "Monthly touchpoint to capture NGO updates, blockers, and needs.",
  schema_json: {
    fields: [
      {
        name: "date",
        type: "date",
        label: "Check-in date",
        required: true,
      },
      {
        name: "period",
        type: "text",
        label: "Reporting period (month/year)",
        required: true,
      },
      {
        name: "summary",
        type: "textarea",
        label: "Summary of activities",
        required: true,
      },
      {
        name: "blockers",
        type: "textarea",
        label: "Blockers",
      },
      {
        name: "needs",
        type: "textarea",
        label: "Needs / support requested",
      },
      {
        name: "notes",
        type: "textarea",
        label: "Additional notes",
      },
    ],
  },
  mapping_json: {},
};

export const documentRequestTemplate: FormTemplateSeed = {
  name: "Document Request",
  module: "ngo_coordination",
  description: "Request a document from an NGO with due date and instructions.",
  schema_json: {
    fields: [
      {
        name: "document_type",
        type: "text",
        label: "Document type",
        required: true,
      },
      {
        name: "due_date",
        type: "date",
        label: "Due date",
        required: true,
      },
      {
        name: "description",
        type: "textarea",
        label: "Description / instructions",
      },
      {
        name: "external_visible",
        type: "checkbox",
        label: "Visible to NGO",
      },
    ],
  },
  mapping_json: {},
};
