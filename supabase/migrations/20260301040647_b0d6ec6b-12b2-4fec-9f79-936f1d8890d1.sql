
-- Purchase Requests: initial request for goods/services
CREATE TABLE public.purchase_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id UUID NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requested_by_user_id UUID REFERENCES public.profiles(id),
  department_id UUID REFERENCES public.org_units(id),
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft',
  estimated_amount NUMERIC,
  currency_code TEXT DEFAULT 'USD',
  needed_by DATE,
  approved_by_user_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Orders: approved orders sent to vendors
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id UUID NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  purchase_request_id UUID REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
  vendor_org_id UUID REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  shipping_address TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  approved_by_user_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PO Line Items
CREATE TABLE public.po_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id),
  received_quantity NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendor Invoices: invoices received from vendors, matched to POs
CREATE TABLE public.vendor_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id UUID NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  vendor_org_id UUID REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'received',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  payment_date DATE,
  payment_reference TEXT,
  transaction_id UUID REFERENCES public.transactions(id),
  approved_by_user_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_purchase_request_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'pending_approval', 'approved', 'rejected', 'canceled') THEN
    RAISE EXCEPTION 'Invalid purchase request status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_pr_status BEFORE INSERT OR UPDATE ON public.purchase_requests FOR EACH ROW EXECUTE FUNCTION public.validate_purchase_request_status();

CREATE OR REPLACE FUNCTION public.validate_purchase_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received', 'closed', 'canceled') THEN
    RAISE EXCEPTION 'Invalid purchase order status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_po_status BEFORE INSERT OR UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.validate_purchase_order_status();

CREATE OR REPLACE FUNCTION public.validate_vendor_invoice_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('received', 'pending_approval', 'approved', 'paid', 'disputed', 'canceled') THEN
    RAISE EXCEPTION 'Invalid vendor invoice status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_vi_status BEFORE INSERT OR UPDATE ON public.vendor_invoices FOR EACH ROW EXECUTE FUNCTION public.validate_vendor_invoice_status();

-- RLS
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;

-- purchase_requests
CREATE POLICY "View purchase requests" ON public.purchase_requests FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert purchase requests" ON public.purchase_requests FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update purchase requests" ON public.purchase_requests FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete purchase requests" ON public.purchase_requests FOR DELETE USING (is_super_admin());

-- purchase_orders
CREATE POLICY "View purchase orders" ON public.purchase_orders FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert purchase orders" ON public.purchase_orders FOR INSERT WITH CHECK (is_internal_user());
CREATE POLICY "Update purchase orders" ON public.purchase_orders FOR UPDATE USING (is_internal_user());
CREATE POLICY "Delete purchase orders" ON public.purchase_orders FOR DELETE USING (is_super_admin());

-- po_line_items (access via parent PO)
CREATE POLICY "View PO line items" ON public.po_line_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_line_items.purchase_order_id AND (is_internal_user() OR has_ngo_access(po.ngo_id))));
CREATE POLICY "Insert PO line items" ON public.po_line_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_line_items.purchase_order_id AND is_internal_user()));
CREATE POLICY "Update PO line items" ON public.po_line_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_line_items.purchase_order_id AND is_internal_user()));
CREATE POLICY "Delete PO line items" ON public.po_line_items FOR DELETE USING (is_super_admin());

-- vendor_invoices
CREATE POLICY "View vendor invoices" ON public.vendor_invoices FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert vendor invoices" ON public.vendor_invoices FOR INSERT WITH CHECK (is_internal_user());
CREATE POLICY "Update vendor invoices" ON public.vendor_invoices FOR UPDATE USING (is_internal_user());
CREATE POLICY "Delete vendor invoices" ON public.vendor_invoices FOR DELETE USING (is_super_admin());
