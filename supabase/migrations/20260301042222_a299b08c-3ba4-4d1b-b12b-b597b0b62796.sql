
-- Inventory Items table
CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  name text NOT NULL,
  sku text,
  category text NOT NULL DEFAULT 'general',
  description text,
  unit_of_measure text NOT NULL DEFAULT 'each',
  quantity_on_hand numeric NOT NULL DEFAULT 0,
  reorder_point numeric DEFAULT 0,
  reorder_quantity numeric DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Stock Movements table
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  movement_type text NOT NULL DEFAULT 'in',
  quantity numeric NOT NULL,
  reference_number text,
  performed_by_user_id uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Supply Requests table
CREATE TABLE public.supply_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id),
  request_number text NOT NULL,
  requested_by_user_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'draft',
  priority text NOT NULL DEFAULT 'normal',
  needed_by date,
  approved_by_user_id uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Supply Request Line Items
CREATE TABLE public.supply_request_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supply_request_id uuid NOT NULL REFERENCES public.supply_requests(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  quantity_requested numeric NOT NULL DEFAULT 1,
  quantity_fulfilled numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_request_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_items
CREATE POLICY "View inventory items" ON public.inventory_items FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert inventory items" ON public.inventory_items FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update inventory items" ON public.inventory_items FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete inventory items" ON public.inventory_items FOR DELETE USING (is_super_admin());

-- RLS policies for stock_movements
CREATE POLICY "View stock movements" ON public.stock_movements FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert stock movements" ON public.stock_movements FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update stock movements" ON public.stock_movements FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete stock movements" ON public.stock_movements FOR DELETE USING (is_super_admin());

-- RLS policies for supply_requests
CREATE POLICY "View supply requests" ON public.supply_requests FOR SELECT USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Insert supply requests" ON public.supply_requests FOR INSERT WITH CHECK (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Update supply requests" ON public.supply_requests FOR UPDATE USING (is_internal_user() OR has_ngo_access(ngo_id));
CREATE POLICY "Delete supply requests" ON public.supply_requests FOR DELETE USING (is_super_admin());

-- RLS policies for supply_request_items
CREATE POLICY "View supply request items" ON public.supply_request_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.supply_requests sr WHERE sr.id = supply_request_items.supply_request_id AND (is_internal_user() OR has_ngo_access(sr.ngo_id))));
CREATE POLICY "Insert supply request items" ON public.supply_request_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.supply_requests sr WHERE sr.id = supply_request_items.supply_request_id AND (is_internal_user() OR has_ngo_access(sr.ngo_id))));
CREATE POLICY "Update supply request items" ON public.supply_request_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.supply_requests sr WHERE sr.id = supply_request_items.supply_request_id AND (is_internal_user() OR has_ngo_access(sr.ngo_id))));
CREATE POLICY "Delete supply request items" ON public.supply_request_items FOR DELETE USING (is_super_admin());

-- Validation triggers
CREATE OR REPLACE FUNCTION public.validate_inventory_item()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.category NOT IN ('general', 'office', 'medical', 'food', 'cleaning', 'technology', 'field_equipment', 'vehicle_parts', 'other') THEN
    RAISE EXCEPTION 'Invalid inventory category: %', NEW.category;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_inventory_item_trigger
BEFORE INSERT OR UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_item();

CREATE OR REPLACE FUNCTION public.validate_stock_movement()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.movement_type NOT IN ('in', 'out', 'transfer', 'adjustment', 'return') THEN
    RAISE EXCEPTION 'Invalid movement type: %', NEW.movement_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_stock_movement_trigger
BEFORE INSERT OR UPDATE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.validate_stock_movement();

CREATE OR REPLACE FUNCTION public.validate_supply_request()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'pending_approval', 'approved', 'partially_fulfilled', 'fulfilled', 'rejected', 'canceled') THEN
    RAISE EXCEPTION 'Invalid supply request status: %', NEW.status;
  END IF;
  IF NEW.priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_supply_request_trigger
BEFORE INSERT OR UPDATE ON public.supply_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_supply_request();
