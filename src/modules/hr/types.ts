export interface StaffProfile {
  id: string;
  user_id: string | null;
  ngo_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  department_id: string | null;
  job_title: string | null;
  employment_type: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  hourly_rate: number | null;
  annual_salary: number | null;
  pto_balance_hours: number;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ngos?: { legal_name: string; common_name: string | null } | null;
  org_units?: { department_name: string } | null;
}

export interface Timesheet {
  id: string;
  staff_id: string;
  ngo_id: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  status: string;
  submitted_at: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  staff_profiles?: { first_name: string; last_name: string } | null;
  ngos?: { legal_name: string; common_name: string | null } | null;
}

export interface PTORequest {
  id: string;
  staff_id: string;
  ngo_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  hours_requested: number;
  status: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  staff_profiles?: { first_name: string; last_name: string } | null;
  ngos?: { legal_name: string; common_name: string | null } | null;
}

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contractor", "volunteer", "intern"] as const;
export const STAFF_STATUSES = ["active", "inactive", "on_leave", "terminated"] as const;
export const TIMESHEET_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
export const LEAVE_TYPES = ["vacation", "sick", "personal", "bereavement", "parental", "other"] as const;
export const PTO_STATUSES = ["pending", "approved", "rejected", "canceled"] as const;
