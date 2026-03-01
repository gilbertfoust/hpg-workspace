export interface StaffProfile {
  id: string;
  name: string;
  role: string;
  department_id?: string;
  status: "active" | "inactive";
}

export interface Timesheet {
  id: string;
  staff_id: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  status: string;
}

export interface PTORequest {
  id: string;
  staff_id: string;
  type: "vacation" | "sick" | "personal";
  start_date: string;
  end_date: string;
  status: string;
}
