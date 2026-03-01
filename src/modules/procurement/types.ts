export interface PurchaseRequest {
  id: string;
  title: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  requested_by: string;
  amount?: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  status: string;
  total: number;
}

export interface VendorInvoice {
  id: string;
  invoice_number: string;
  vendor_id: string;
  amount: number;
  status: string;
}

export interface GoodsReceivedNote {
  id: string;
  po_id: string;
  received_date: string;
  status: string;
}
