export interface PurchaseRequest {
  id: string;
  ngo_id: string;
  title: string;
  description: string | null;
  requested_by_user_id: string | null;
  department_id: string | null;
  priority: string;
  status: string;
  estimated_amount: number | null;
  currency_code: string | null;
  needed_by: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ngos?: { legal_name: string; common_name: string | null } | null;
  profiles?: { full_name: string | null } | null;
  org_units?: { department_name: string } | null;
}

export interface PurchaseOrder {
  id: string;
  ngo_id: string;
  purchase_request_id: string | null;
  vendor_org_id: string | null;
  po_number: string;
  status: string;
  order_date: string;
  expected_delivery: string | null;
  shipping_address: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency_code: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  created_by_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ngos?: { legal_name: string; common_name: string | null } | null;
  crm_organizations?: { name: string } | null;
}

export interface POLineItem {
  id: string;
  purchase_order_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  account_id: string | null;
  received_quantity: number | null;
  created_at: string;
}

export interface VendorInvoice {
  id: string;
  ngo_id: string;
  purchase_order_id: string | null;
  vendor_org_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency_code: string | null;
  payment_date: string | null;
  payment_reference: string | null;
  transaction_id: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ngos?: { legal_name: string; common_name: string | null } | null;
  crm_organizations?: { name: string } | null;
  purchase_orders?: { po_number: string } | null;
}

export const PR_STATUSES = ["draft", "pending_approval", "approved", "rejected", "canceled"] as const;
export const PO_STATUSES = ["draft", "pending_approval", "approved", "sent", "partially_received", "received", "closed", "canceled"] as const;
export const VI_STATUSES = ["received", "pending_approval", "approved", "paid", "disputed", "canceled"] as const;
