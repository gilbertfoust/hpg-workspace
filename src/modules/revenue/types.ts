export interface RevenueStream {
  id: string;
  name: string;
  type: "donation" | "program" | "grant" | "sponsorship" | "other";
  restriction: "unrestricted" | "temporarily_restricted" | "permanently_restricted";
}

export interface RecurringDonation {
  id: string;
  donor_id: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "annually";
  status: "active" | "paused" | "cancelled";
}

export interface RevenueRecognitionSchedule {
  id: string;
  revenue_stream_id: string;
  total_amount: number;
  recognized_to_date: number;
  schedule: { period: string; amount: number }[];
}
