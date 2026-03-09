-- Inter-NGO Transfers table for fund movements between NGOs
CREATE TABLE public.inter_ngo_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_ngo_id UUID REFERENCES public.ngos(id) ON DELETE CASCADE NOT NULL,
  to_ngo_id UUID REFERENCES public.ngos(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_inter_ngo_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'completed', 'canceled') THEN
    RAISE EXCEPTION 'Invalid transfer status: %', NEW.status;
  END IF;
  IF NEW.from_ngo_id = NEW.to_ngo_id THEN
    RAISE EXCEPTION 'Source and destination NGO cannot be the same';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_inter_ngo_transfer
  BEFORE INSERT OR UPDATE ON public.inter_ngo_transfers
  FOR EACH ROW EXECUTE FUNCTION public.validate_inter_ngo_transfer();

-- RLS
ALTER TABLE public.inter_ngo_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view all transfers"
  ON public.inter_ngo_transfers FOR SELECT
  TO authenticated
  USING (public.is_internal_user());

CREATE POLICY "Management can manage transfers"
  ON public.inter_ngo_transfers FOR ALL
  TO authenticated
  USING (public.is_management())
  WITH CHECK (public.is_management());

-- Index
CREATE INDEX idx_inter_ngo_transfers_status ON public.inter_ngo_transfers(status);
CREATE INDEX idx_inter_ngo_transfers_from_ngo ON public.inter_ngo_transfers(from_ngo_id);
CREATE INDEX idx_inter_ngo_transfers_to_ngo ON public.inter_ngo_transfers(to_ngo_id);