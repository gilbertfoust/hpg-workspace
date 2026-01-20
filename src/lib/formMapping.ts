import { FormTemplate } from "@/hooks/useFormTemplates";
import type { CreateWorkItemInput, ModuleType, WorkItem, Priority } from "@/hooks/useWorkItems";

interface WorkItemPlan {
  action: "create" | "update" | "skip";
  workItemId?: string;
  createInput?: CreateWorkItemInput;
  updateInput?: Partial<WorkItem>;
}

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const toString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const toPriority = (value: unknown) =>
  typeof value === "string" ? (value as Priority) : undefined;

const toModuleType = (value: unknown) =>
  typeof value === "string" ? (value as ModuleType) : undefined;

const getValue = (payload: Record<string, unknown>, key?: string) => {
  if (!key) return undefined;
  return payload[key];
};

const resolveValue = (
  payload: Record<string, unknown>,
  fieldMap: Record<string, string> | undefined,
  target: string,
  fallbackKeys: string[],
  defaults: Record<string, unknown>
) => {
  const mappedKey = fieldMap?.[target];
  if (mappedKey && payload[mappedKey] !== undefined) {
    return payload[mappedKey];
  }
  for (const key of fallbackKeys) {
    if (payload[key] !== undefined) return payload[key];
  }
  return defaults[target];
};

export const buildWorkItemPlan = (
  template: FormTemplate,
  payload: Record<string, unknown>,
  ngoId?: string | null
): WorkItemPlan => {
  const mapping = toRecord(template.mapping_json);
  const workItemMapping = toRecord(mapping.work_item);

  if (workItemMapping.action === "none" || workItemMapping.action === "skip") {
    return { action: "skip" };
  }

  const fieldMap = toRecord(workItemMapping.field_map || workItemMapping.fields) as Record<string, string>;
  const defaults = toRecord(workItemMapping.defaults);

  const workItemId =
    toString(getValue(payload, toString(workItemMapping.id_field) || undefined)) ||
    toString(getValue(payload, "work_item_id")) ||
    toString(workItemMapping.work_item_id);

  let action =
    (toString(workItemMapping.action) as "create" | "update" | undefined) ||
    (workItemId ? "update" : "create");
  if (action === "update" && !workItemId) {
    action = "create";
  }

  const mappedTitle = toString(
    resolveValue(payload, fieldMap, "title", ["title", "work_item_title", "name"], defaults)
  );
  const title = mappedTitle || template.name;

  const description = toString(
    resolveValue(payload, fieldMap, "description", ["description", "details", "summary"], defaults)
  );

  const departmentId = toString(
    resolveValue(payload, fieldMap, "department_id", ["department_id", "department"], defaults)
  );

  const ownerUserId = toString(
    resolveValue(payload, fieldMap, "owner_user_id", ["owner_user_id", "owner"], defaults)
  );

  const dueDate = toString(
    resolveValue(payload, fieldMap, "due_date", ["due_date", "dueDate"], defaults)
  );

  const type = toString(
    resolveValue(payload, fieldMap, "type", ["type", "work_item_type"], defaults)
  );

  const priority = toPriority(
    resolveValue(payload, fieldMap, "priority", ["priority"], defaults)
  );

  const moduleOverride = toModuleType(workItemMapping.module || mapping.module);

  const createInput: CreateWorkItemInput = {
    title,
    module: moduleOverride || template.module,
    description,
    department_id: departmentId,
    owner_user_id: ownerUserId,
    due_date: dueDate,
    priority,
    ngo_id: ngoId || undefined,
  };

  const updateInput: Partial<WorkItem> = {
    title: mappedTitle,
    description,
    department_id: departmentId,
    owner_user_id: ownerUserId,
    due_date: dueDate,
    type,
    priority,
    module: moduleOverride || template.module,
    ngo_id: ngoId || undefined,
  };

  return {
    action,
    workItemId: workItemId || undefined,
    createInput,
    updateInput,
  };
};
