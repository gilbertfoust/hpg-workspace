export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string;
  before_json?: Record<string, unknown>;
  after_json?: Record<string, unknown>;
  created_at: string;
}

export interface PermissionChange {
  id: string;
  user_id: string;
  old_role: string;
  new_role: string;
  changed_by: string;
  changed_at: string;
}
