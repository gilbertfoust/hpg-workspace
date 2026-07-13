-- Finance Hub production completion
--
-- Completes the operational request/approval layer, aligns Finance authority
-- with the user's department, and removes implicit function execution grants.

-- ---------------------------------------------------------------------------
-- Department-scoped Finance authority
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_finance_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_finance_ledger_manager()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.org_units ou ON ou.id = p.department_id
      WHERE p.id = auth.uid()
        AND lower(trim(ou.department_name)) = 'finance'
        AND (
          p.role IN ('department_lead', 'staff', 'staff_member', 'vp_finance')
          OR EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = p.id
              AND ur.role::text IN ('department_lead', 'staff', 'staff_member', 'vp_finance')
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_finance_drafts()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_finance_staff();
$$;

CREATE OR REPLACE FUNCTION public.can_read_finance_ledger()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_finance_ledger_manager()
    OR public.is_finance_auditor()
    OR (public.is_internal_user() AND NOT public.is_ngo_user());
$$;

CREATE OR REPLACE FUNCTION public.get_finance_access_capabilities()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'can_read', public.can_read_finance_ledger(),
    'can_submit_requests', public.is_internal_user(),
    'can_prepare_budgets', public.is_finance_staff(),
    'can_review', public.is_finance_ledger_manager(),
    'is_finance_staff', public.is_finance_staff()
  );
$$;

-- ---------------------------------------------------------------------------
-- Expense requests and the durable workflow notification outbox
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.finance_expense_request_number_seq;

CREATE TABLE IF NOT EXISTS public.finance_expense_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE DEFAULT (
    'ER-' || to_char(CURRENT_DATE, 'YYYY') || '-' ||
    lpad(nextval('public.finance_expense_request_number_seq')::text, 6, '0')
  ),
  requester_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  payee_name text NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(18, 2) NOT NULL CHECK (amount > 0),
  currency_code text NOT NULL DEFAULT 'USD',
  category text NOT NULL,
  business_purpose text NOT NULL,
  description text,
  receipt_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  budget_id uuid REFERENCES public.finance_budgets(id) ON DELETE SET NULL,
  budget_account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'submitted', 'approved', 'rejected', 'paid', 'canceled')
  ),
  submitted_at timestamptz,
  reviewed_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejected_reason text,
  paid_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_expense_requests_status
  ON public.finance_expense_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_expense_requests_requester
  ON public.finance_expense_requests(requester_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_expense_requests_work_item
  ON public.finance_expense_requests(work_item_id);

DROP TRIGGER IF EXISTS trg_finance_expense_requests_updated_at ON public.finance_expense_requests;
CREATE TRIGGER trg_finance_expense_requests_updated_at
  BEFORE UPDATE ON public.finance_expense_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.finance_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('expense_request', 'purchase_request', 'budget')),
  entity_id uuid NOT NULL,
  work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('submitted', 'approved', 'rejected', 'paid')),
  notification_type text NOT NULL CHECK (notification_type IN ('slack', 'email', 'in_app')),
  notification_status text NOT NULL DEFAULT 'queued' CHECK (
    notification_status IN ('queued', 'sent', 'skipped', 'failed')
  ),
  recipient text,
  error_message text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_finance_workflow_events_queue
  ON public.finance_workflow_events(notification_status, created_at);
CREATE INDEX IF NOT EXISTS idx_finance_workflow_events_entity
  ON public.finance_workflow_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_workflow_events_work_item
  ON public.finance_workflow_events(work_item_id);

ALTER TABLE public.finance_expense_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_workflow_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance expense requests read" ON public.finance_expense_requests;
CREATE POLICY "finance expense requests read"
  ON public.finance_expense_requests FOR SELECT TO authenticated
  USING (
    requester_user_id = auth.uid()
    OR public.is_finance_staff()
    OR (
      department_id = public.get_my_department()
      AND (
        public.has_role(auth.uid(), 'department_lead')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'department_lead'
        )
      )
    )
  );

DROP POLICY IF EXISTS "finance workflow events read" ON public.finance_workflow_events;
CREATE POLICY "finance workflow events read"
  ON public.finance_workflow_events FOR SELECT TO authenticated
  USING (public.is_finance_staff());

-- ---------------------------------------------------------------------------
-- Existing purchase requests and budgets: workflow metadata and tight RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_requests_work_item
  ON public.purchase_requests(work_item_id);

ALTER TABLE public.finance_budgets
  DROP CONSTRAINT IF EXISTS finance_budgets_status_check;
ALTER TABLE public.finance_budgets
  ADD CONSTRAINT finance_budgets_status_check CHECK (
    status IN ('draft', 'pending_approval', 'approved', 'rejected', 'active', 'closed')
  ),
  ADD COLUMN IF NOT EXISTS work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text;

CREATE INDEX IF NOT EXISTS idx_finance_budgets_work_item
  ON public.finance_budgets(work_item_id);

DROP POLICY IF EXISTS "Insert purchase requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "Update purchase requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "Delete purchase requests" ON public.purchase_requests;

DROP POLICY IF EXISTS "finance budgets manage" ON public.finance_budgets;
DROP POLICY IF EXISTS "finance budget lines manage" ON public.finance_budget_lines;

-- All writes go through the RPCs below so state transitions cannot be forged
-- by changing a status column directly through the Data API.
REVOKE INSERT, UPDATE, DELETE ON public.finance_expense_requests FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.finance_workflow_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.purchase_requests FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.finance_budgets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.finance_budget_lines FROM authenticated;

GRANT SELECT ON public.finance_expense_requests TO authenticated;
GRANT SELECT ON public.finance_workflow_events TO authenticated;
GRANT SELECT ON public.purchase_requests TO authenticated;
GRANT SELECT ON public.finance_budgets TO authenticated;
GRANT SELECT ON public.finance_budget_lines TO authenticated;

-- ---------------------------------------------------------------------------
-- Internal workflow helpers (not exposed through the Data API)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finance_create_approval_work_item(
  _entity_type text,
  _title text,
  _description text,
  _ngo_id uuid DEFAULT NULL,
  _priority text DEFAULT 'medium'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  finance_department public.org_units;
  new_work_item_id uuid;
  normalized_priority public.priority_level;
BEGIN
  SELECT * INTO finance_department
  FROM public.org_units
  WHERE lower(trim(department_name)) = 'finance'
  ORDER BY created_at
  LIMIT 1;

  normalized_priority := CASE lower(COALESCE(_priority, 'medium'))
    WHEN 'high' THEN 'high'::public.priority_level
    WHEN 'low' THEN 'low'::public.priority_level
    ELSE 'medium'::public.priority_level
  END;

  INSERT INTO public.work_items (
    ngo_id,
    module,
    type,
    title,
    description,
    department_id,
    owner_user_id,
    created_by_user_id,
    status,
    priority,
    approval_required,
    approver_user_id,
    evidence_required
  ) VALUES (
    _ngo_id,
    'finance',
    _entity_type,
    _title,
    _description,
    finance_department.id,
    finance_department.lead_user_id,
    auth.uid(),
    'submitted',
    normalized_priority,
    true,
    finance_department.lead_user_id,
    _entity_type = 'expense_request'
  )
  RETURNING id INTO new_work_item_id;

  RETURN new_work_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_set_approval_work_item_status(
  _work_item_id uuid,
  _status public.work_item_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _work_item_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.work_items
  SET status = _status,
      completed_at = CASE WHEN _status IN ('approved', 'rejected', 'complete', 'canceled') THEN now() ELSE NULL END
  WHERE id = _work_item_id
    AND module = 'finance';
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_queue_workflow_notifications(
  _entity_type text,
  _entity_id uuid,
  _work_item_id uuid,
  _event_type text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  route_record public.department_notification_routes;
  recipient text;
  queued_count integer := 0;
BEGIN
  SELECT * INTO route_record
  FROM public.department_notification_routes
  WHERE module = 'finance' AND is_active = true
  LIMIT 1;

  IF route_record.slack_channel IS NOT NULL AND length(trim(route_record.slack_channel)) > 0 THEN
    INSERT INTO public.finance_workflow_events (
      entity_type, entity_id, work_item_id, event_type,
      notification_type, recipient, metadata_json
    ) VALUES (
      _entity_type, _entity_id, _work_item_id, _event_type,
      'slack', route_record.slack_channel, COALESCE(_metadata, '{}'::jsonb)
    );
    queued_count := queued_count + 1;
  END IF;

  IF route_record.email_recipients IS NOT NULL THEN
    FOREACH recipient IN ARRAY route_record.email_recipients LOOP
      IF recipient IS NOT NULL AND length(trim(recipient)) > 0 THEN
        INSERT INTO public.finance_workflow_events (
          entity_type, entity_id, work_item_id, event_type,
          notification_type, recipient, metadata_json
        ) VALUES (
          _entity_type, _entity_id, _work_item_id, _event_type,
          'email', recipient, COALESCE(_metadata, '{}'::jsonb)
        );
        queued_count := queued_count + 1;
      END IF;
    END LOOP;
  END IF;

  IF queued_count = 0 THEN
    INSERT INTO public.finance_workflow_events (
      entity_type, entity_id, work_item_id, event_type,
      notification_type, notification_status, metadata_json
    ) VALUES (
      _entity_type, _entity_id, _work_item_id, _event_type,
      'in_app', 'skipped', COALESCE(_metadata, '{}'::jsonb) ||
        jsonb_build_object('reason', 'No active Finance notification recipient is configured.')
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Expense request RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_finance_expense_request(
  _request_id uuid DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.finance_expense_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expense public.finance_expense_requests;
  requester_department_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Internal HPG access required';
  END IF;

  SELECT department_id INTO requester_department_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF nullif(trim(_payload->>'payee_name'), '') IS NULL
    OR nullif(trim(_payload->>'category'), '') IS NULL
    OR nullif(trim(_payload->>'business_purpose'), '') IS NULL
    OR COALESCE((_payload->>'amount')::numeric, 0) <= 0 THEN
    RAISE EXCEPTION 'Payee, category, business purpose, and a positive amount are required';
  END IF;

  IF _request_id IS NULL THEN
    INSERT INTO public.finance_expense_requests (
      requester_user_id, department_id, ngo_id, payee_name, expense_date,
      amount, currency_code, category, business_purpose, description,
      receipt_document_id, budget_id, budget_account_id
    ) VALUES (
      auth.uid(),
      COALESCE(nullif(_payload->>'department_id', '')::uuid, requester_department_id),
      nullif(_payload->>'ngo_id', '')::uuid,
      trim(_payload->>'payee_name'),
      COALESCE(nullif(_payload->>'expense_date', '')::date, CURRENT_DATE),
      (_payload->>'amount')::numeric,
      COALESCE(nullif(upper(trim(_payload->>'currency_code')), ''), 'USD'),
      trim(_payload->>'category'),
      trim(_payload->>'business_purpose'),
      nullif(trim(_payload->>'description'), ''),
      nullif(_payload->>'receipt_document_id', '')::uuid,
      nullif(_payload->>'budget_id', '')::uuid,
      nullif(_payload->>'budget_account_id', '')::uuid
    ) RETURNING * INTO expense;
  ELSE
    SELECT * INTO expense
    FROM public.finance_expense_requests
    WHERE id = _request_id
    FOR UPDATE;

    IF expense.id IS NULL THEN RAISE EXCEPTION 'Expense request not found'; END IF;
    IF expense.requester_user_id <> auth.uid() THEN RAISE EXCEPTION 'Only the requestor can edit this request'; END IF;
    IF expense.status NOT IN ('draft', 'rejected') THEN RAISE EXCEPTION 'Only draft or rejected requests can be edited'; END IF;

    UPDATE public.finance_expense_requests
    SET ngo_id = nullif(_payload->>'ngo_id', '')::uuid,
        payee_name = trim(_payload->>'payee_name'),
        expense_date = COALESCE(nullif(_payload->>'expense_date', '')::date, expense_date),
        amount = (_payload->>'amount')::numeric,
        currency_code = COALESCE(nullif(upper(trim(_payload->>'currency_code')), ''), 'USD'),
        category = trim(_payload->>'category'),
        business_purpose = trim(_payload->>'business_purpose'),
        description = nullif(trim(_payload->>'description'), ''),
        receipt_document_id = nullif(_payload->>'receipt_document_id', '')::uuid,
        budget_id = nullif(_payload->>'budget_id', '')::uuid,
        budget_account_id = nullif(_payload->>'budget_account_id', '')::uuid,
        status = 'draft',
        rejected_reason = NULL,
        reviewed_by_user_id = NULL,
        reviewed_at = NULL
    WHERE id = _request_id
    RETURNING * INTO expense;
  END IF;

  PERFORM public.finance_log_audit_event(
    'expense_request', expense.id,
    CASE WHEN _request_id IS NULL THEN 'created' ELSE 'updated' END,
    jsonb_build_object('request_number', expense.request_number, 'amount', expense.amount)
  );
  RETURN expense;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_finance_expense_request(_request_id uuid)
RETURNS public.finance_expense_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expense public.finance_expense_requests;
  approval_work_item_id uuid;
BEGIN
  SELECT * INTO expense
  FROM public.finance_expense_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF expense.id IS NULL THEN RAISE EXCEPTION 'Expense request not found'; END IF;
  IF expense.requester_user_id <> auth.uid() THEN RAISE EXCEPTION 'Only the requestor can submit this request'; END IF;
  IF expense.status <> 'draft' THEN RAISE EXCEPTION 'Only draft requests can be submitted'; END IF;

  approval_work_item_id := COALESCE(
    expense.work_item_id,
    public.finance_create_approval_work_item(
      'expense_request',
      'Review expense request ' || expense.request_number,
      expense.business_purpose,
      expense.ngo_id,
      'medium'
    )
  );

  UPDATE public.finance_expense_requests
  SET status = 'submitted', submitted_at = now(), work_item_id = approval_work_item_id
  WHERE id = _request_id
  RETURNING * INTO expense;

  PERFORM public.finance_log_audit_event('expense_request', expense.id, 'submitted', jsonb_build_object('amount', expense.amount));
  PERFORM public.finance_queue_workflow_notifications(
    'expense_request', expense.id, expense.work_item_id, 'submitted',
    jsonb_build_object('request_number', expense.request_number, 'payee', expense.payee_name, 'amount', expense.amount)
  );
  RETURN expense;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_finance_expense_request(
  _request_id uuid,
  _decision text,
  _reason text DEFAULT NULL
)
RETURNS public.finance_expense_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expense public.finance_expense_requests;
  normalized_decision text := lower(trim(_decision));
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF normalized_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Decision must be approved or rejected'; END IF;
  IF normalized_decision = 'rejected' AND nullif(trim(_reason), '') IS NULL THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;

  SELECT * INTO expense FROM public.finance_expense_requests WHERE id = _request_id FOR UPDATE;
  IF expense.id IS NULL THEN RAISE EXCEPTION 'Expense request not found'; END IF;
  IF expense.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted requests can be reviewed'; END IF;

  UPDATE public.finance_expense_requests
  SET status = normalized_decision,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      rejected_reason = CASE WHEN normalized_decision = 'rejected' THEN trim(_reason) ELSE NULL END
  WHERE id = _request_id
  RETURNING * INTO expense;

  PERFORM public.finance_set_approval_work_item_status(expense.work_item_id, normalized_decision::public.work_item_status);
  PERFORM public.finance_log_audit_event('expense_request', expense.id, normalized_decision, jsonb_build_object('reason', _reason));
  PERFORM public.finance_queue_workflow_notifications(
    'expense_request', expense.id, expense.work_item_id, normalized_decision,
    jsonb_build_object('request_number', expense.request_number, 'amount', expense.amount, 'reason', _reason)
  );
  RETURN expense;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_finance_expense_request_paid(
  _request_id uuid,
  _payment_reference text
)
RETURNS public.finance_expense_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expense public.finance_expense_requests;
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF nullif(trim(_payment_reference), '') IS NULL THEN RAISE EXCEPTION 'Payment reference is required'; END IF;

  SELECT * INTO expense FROM public.finance_expense_requests WHERE id = _request_id FOR UPDATE;
  IF expense.id IS NULL THEN RAISE EXCEPTION 'Expense request not found'; END IF;
  IF expense.status <> 'approved' THEN RAISE EXCEPTION 'Only approved requests can be marked paid'; END IF;

  UPDATE public.finance_expense_requests
  SET status = 'paid', paid_by_user_id = auth.uid(), paid_at = now(), payment_reference = trim(_payment_reference)
  WHERE id = _request_id
  RETURNING * INTO expense;

  PERFORM public.finance_set_approval_work_item_status(expense.work_item_id, 'complete');
  PERFORM public.finance_log_audit_event('expense_request', expense.id, 'paid', jsonb_build_object('payment_reference', expense.payment_reference));
  PERFORM public.finance_queue_workflow_notifications(
    'expense_request', expense.id, expense.work_item_id, 'paid',
    jsonb_build_object('request_number', expense.request_number, 'payment_reference', expense.payment_reference)
  );
  RETURN expense;
END;
$$;

-- ---------------------------------------------------------------------------
-- Purchase request RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_purchase_request(
  _request_id uuid DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.purchase_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record public.purchase_requests;
  requester_department_id uuid;
  normalized_priority text := lower(COALESCE(nullif(trim(_payload->>'priority'), ''), 'medium'));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_user() THEN RAISE EXCEPTION 'Internal HPG access required'; END IF;
  IF nullif(trim(_payload->>'title'), '') IS NULL OR nullif(_payload->>'ngo_id', '') IS NULL THEN
    RAISE EXCEPTION 'Title and NGO are required';
  END IF;
  IF normalized_priority NOT IN ('low', 'medium', 'high') THEN RAISE EXCEPTION 'Priority must be low, medium, or high'; END IF;

  SELECT department_id INTO requester_department_id FROM public.profiles WHERE id = auth.uid();

  IF _request_id IS NULL THEN
    INSERT INTO public.purchase_requests (
      ngo_id, title, description, requested_by_user_id, department_id,
      priority, estimated_amount, currency_code, needed_by, notes, status
    ) VALUES (
      (_payload->>'ngo_id')::uuid,
      trim(_payload->>'title'),
      nullif(trim(_payload->>'description'), ''),
      auth.uid(),
      COALESCE(nullif(_payload->>'department_id', '')::uuid, requester_department_id),
      normalized_priority,
      nullif(_payload->>'estimated_amount', '')::numeric,
      COALESCE(nullif(upper(trim(_payload->>'currency_code')), ''), 'USD'),
      nullif(_payload->>'needed_by', '')::date,
      nullif(trim(_payload->>'notes'), ''),
      'draft'
    ) RETURNING * INTO request_record;
  ELSE
    SELECT * INTO request_record FROM public.purchase_requests WHERE id = _request_id FOR UPDATE;
    IF request_record.id IS NULL THEN RAISE EXCEPTION 'Purchase request not found'; END IF;
    IF request_record.requested_by_user_id <> auth.uid() THEN RAISE EXCEPTION 'Only the requestor can edit this request'; END IF;
    IF request_record.status NOT IN ('draft', 'rejected') THEN RAISE EXCEPTION 'Only draft or rejected requests can be edited'; END IF;

    UPDATE public.purchase_requests
    SET ngo_id = (_payload->>'ngo_id')::uuid,
        title = trim(_payload->>'title'),
        description = nullif(trim(_payload->>'description'), ''),
        priority = normalized_priority,
        estimated_amount = nullif(_payload->>'estimated_amount', '')::numeric,
        currency_code = COALESCE(nullif(upper(trim(_payload->>'currency_code')), ''), 'USD'),
        needed_by = nullif(_payload->>'needed_by', '')::date,
        notes = nullif(trim(_payload->>'notes'), ''),
        status = 'draft',
        rejected_reason = NULL,
        reviewed_by_user_id = NULL,
        reviewed_at = NULL
    WHERE id = _request_id
    RETURNING * INTO request_record;
  END IF;

  PERFORM public.finance_log_audit_event(
    'purchase_request', request_record.id,
    CASE WHEN _request_id IS NULL THEN 'created' ELSE 'updated' END,
    jsonb_build_object('title', request_record.title, 'estimated_amount', request_record.estimated_amount)
  );
  RETURN request_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_purchase_request(_request_id uuid)
RETURNS public.purchase_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record public.purchase_requests;
  approval_work_item_id uuid;
BEGIN
  SELECT * INTO request_record FROM public.purchase_requests WHERE id = _request_id FOR UPDATE;
  IF request_record.id IS NULL THEN RAISE EXCEPTION 'Purchase request not found'; END IF;
  IF request_record.requested_by_user_id <> auth.uid() THEN RAISE EXCEPTION 'Only the requestor can submit this request'; END IF;
  IF request_record.status <> 'draft' THEN RAISE EXCEPTION 'Only draft requests can be submitted'; END IF;

  approval_work_item_id := COALESCE(
    request_record.work_item_id,
    public.finance_create_approval_work_item(
      'purchase_request',
      'Review purchase request: ' || request_record.title,
      COALESCE(request_record.description, request_record.title),
      request_record.ngo_id,
      request_record.priority
    )
  );

  UPDATE public.purchase_requests
  SET status = 'pending_approval', submitted_at = now(), work_item_id = approval_work_item_id
  WHERE id = _request_id
  RETURNING * INTO request_record;

  PERFORM public.finance_log_audit_event('purchase_request', request_record.id, 'submitted', jsonb_build_object('estimated_amount', request_record.estimated_amount));
  PERFORM public.finance_queue_workflow_notifications(
    'purchase_request', request_record.id, request_record.work_item_id, 'submitted',
    jsonb_build_object('title', request_record.title, 'estimated_amount', request_record.estimated_amount)
  );
  RETURN request_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_purchase_request(
  _request_id uuid,
  _decision text,
  _reason text DEFAULT NULL
)
RETURNS public.purchase_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record public.purchase_requests;
  normalized_decision text := lower(trim(_decision));
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF normalized_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Decision must be approved or rejected'; END IF;
  IF normalized_decision = 'rejected' AND nullif(trim(_reason), '') IS NULL THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;

  SELECT * INTO request_record FROM public.purchase_requests WHERE id = _request_id FOR UPDATE;
  IF request_record.id IS NULL THEN RAISE EXCEPTION 'Purchase request not found'; END IF;
  IF request_record.status <> 'pending_approval' THEN RAISE EXCEPTION 'Only pending requests can be reviewed'; END IF;

  UPDATE public.purchase_requests
  SET status = normalized_decision,
      approved_by_user_id = CASE WHEN normalized_decision = 'approved' THEN auth.uid() ELSE NULL END,
      approved_at = CASE WHEN normalized_decision = 'approved' THEN now() ELSE NULL END,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      rejected_reason = CASE WHEN normalized_decision = 'rejected' THEN trim(_reason) ELSE NULL END
  WHERE id = _request_id
  RETURNING * INTO request_record;

  PERFORM public.finance_set_approval_work_item_status(request_record.work_item_id, normalized_decision::public.work_item_status);
  PERFORM public.finance_log_audit_event('purchase_request', request_record.id, normalized_decision, jsonb_build_object('reason', _reason));
  PERFORM public.finance_queue_workflow_notifications(
    'purchase_request', request_record.id, request_record.work_item_id, normalized_decision,
    jsonb_build_object('title', request_record.title, 'estimated_amount', request_record.estimated_amount, 'reason', _reason)
  );
  RETURN request_record;
END;
$$;

-- ---------------------------------------------------------------------------
-- Atomic budget save and approval RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_finance_budget(
  _budget_id uuid DEFAULT NULL,
  _header jsonb DEFAULT '{}'::jsonb,
  _lines jsonb DEFAULT NULL
)
RETURNS public.finance_budgets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  budget public.finance_budgets;
BEGIN
  IF NOT public.is_finance_staff() THEN RAISE EXCEPTION 'Finance staff access required'; END IF;
  IF _lines IS NOT NULL AND jsonb_typeof(_lines) <> 'array' THEN RAISE EXCEPTION 'Budget lines must be a JSON array'; END IF;

  IF _budget_id IS NULL THEN
    IF nullif(trim(_header->>'name'), '') IS NULL OR (_header->>'fiscal_year')::integer IS NULL THEN
      RAISE EXCEPTION 'Budget name and fiscal year are required';
    END IF;

    INSERT INTO public.finance_budgets (
      name, fiscal_year, scope_type, department_id, ngo_id, fund_id,
      grant_application_id, status, memo, created_by_user_id
    ) VALUES (
      trim(_header->>'name'),
      (_header->>'fiscal_year')::integer,
      COALESCE(nullif(_header->>'scope_type', ''), 'organization'),
      nullif(_header->>'department_id', '')::uuid,
      nullif(_header->>'ngo_id', '')::uuid,
      nullif(_header->>'fund_id', '')::uuid,
      nullif(_header->>'grant_application_id', '')::uuid,
      'draft',
      nullif(trim(_header->>'memo'), ''),
      auth.uid()
    ) RETURNING * INTO budget;
  ELSE
    SELECT * INTO budget FROM public.finance_budgets WHERE id = _budget_id FOR UPDATE;
    IF budget.id IS NULL THEN RAISE EXCEPTION 'Budget not found'; END IF;
    IF budget.status NOT IN ('draft', 'rejected') THEN RAISE EXCEPTION 'Only draft or rejected budgets can be edited'; END IF;

    UPDATE public.finance_budgets
    SET name = COALESCE(nullif(trim(_header->>'name'), ''), budget.name),
        fiscal_year = COALESCE(nullif(_header->>'fiscal_year', '')::integer, budget.fiscal_year),
        scope_type = COALESCE(nullif(_header->>'scope_type', ''), budget.scope_type),
        department_id = CASE WHEN _header ? 'department_id' THEN nullif(_header->>'department_id', '')::uuid ELSE budget.department_id END,
        ngo_id = CASE WHEN _header ? 'ngo_id' THEN nullif(_header->>'ngo_id', '')::uuid ELSE budget.ngo_id END,
        fund_id = CASE WHEN _header ? 'fund_id' THEN nullif(_header->>'fund_id', '')::uuid ELSE budget.fund_id END,
        grant_application_id = CASE WHEN _header ? 'grant_application_id' THEN nullif(_header->>'grant_application_id', '')::uuid ELSE budget.grant_application_id END,
        memo = CASE WHEN _header ? 'memo' THEN nullif(trim(_header->>'memo'), '') ELSE budget.memo END,
        status = 'draft',
        rejected_reason = NULL,
        reviewed_by_user_id = NULL,
        reviewed_at = NULL
    WHERE id = _budget_id
    RETURNING * INTO budget;
  END IF;

  IF _lines IS NOT NULL THEN
    DELETE FROM public.finance_budget_lines WHERE budget_id = budget.id;
    INSERT INTO public.finance_budget_lines (budget_id, account_id, period_month, amount, memo)
    SELECT budget.id, line.account_id, line.period_month, line.amount, line.memo
    FROM jsonb_to_recordset(_lines) AS line(
      account_id uuid,
      period_month integer,
      amount numeric,
      memo text
    );
  END IF;

  PERFORM public.finance_log_audit_event(
    'budget', budget.id,
    CASE WHEN _budget_id IS NULL THEN 'created' ELSE 'updated' END,
    jsonb_build_object('name', budget.name, 'fiscal_year', budget.fiscal_year)
  );
  RETURN budget;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_finance_budget(_budget_id uuid)
RETURNS public.finance_budgets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  budget public.finance_budgets;
  approval_work_item_id uuid;
  line_count integer;
  budget_total numeric;
BEGIN
  IF NOT public.is_finance_staff() THEN RAISE EXCEPTION 'Finance staff access required'; END IF;

  SELECT * INTO budget FROM public.finance_budgets WHERE id = _budget_id FOR UPDATE;
  IF budget.id IS NULL THEN RAISE EXCEPTION 'Budget not found'; END IF;
  IF budget.status <> 'draft' THEN RAISE EXCEPTION 'Only draft budgets can be submitted'; END IF;

  SELECT count(*), COALESCE(sum(amount), 0)
  INTO line_count, budget_total
  FROM public.finance_budget_lines
  WHERE budget_id = _budget_id;
  IF line_count = 0 OR budget_total <= 0 THEN RAISE EXCEPTION 'Budget must contain at least one positive line'; END IF;

  approval_work_item_id := COALESCE(
    budget.work_item_id,
    public.finance_create_approval_work_item(
      'budget',
      'Review budget: ' || budget.name,
      'Approve FY' || budget.fiscal_year || ' budget totaling ' || budget_total,
      budget.ngo_id,
      'high'
    )
  );

  UPDATE public.finance_budgets
  SET status = 'pending_approval', submitted_at = now(), work_item_id = approval_work_item_id
  WHERE id = _budget_id
  RETURNING * INTO budget;

  PERFORM public.finance_log_audit_event('budget', budget.id, 'submitted', jsonb_build_object('total', budget_total));
  PERFORM public.finance_queue_workflow_notifications(
    'budget', budget.id, budget.work_item_id, 'submitted',
    jsonb_build_object('name', budget.name, 'fiscal_year', budget.fiscal_year, 'total', budget_total)
  );
  RETURN budget;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_finance_budget(
  _budget_id uuid,
  _decision text,
  _reason text DEFAULT NULL
)
RETURNS public.finance_budgets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  budget public.finance_budgets;
  normalized_decision text := lower(trim(_decision));
BEGIN
  IF NOT public.is_finance_ledger_manager() THEN RAISE EXCEPTION 'Finance manager access required'; END IF;
  IF normalized_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Decision must be approved or rejected'; END IF;
  IF normalized_decision = 'rejected' AND nullif(trim(_reason), '') IS NULL THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;

  SELECT * INTO budget FROM public.finance_budgets WHERE id = _budget_id FOR UPDATE;
  IF budget.id IS NULL THEN RAISE EXCEPTION 'Budget not found'; END IF;
  IF budget.status <> 'pending_approval' THEN RAISE EXCEPTION 'Only pending budgets can be reviewed'; END IF;

  UPDATE public.finance_budgets
  SET status = normalized_decision,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      rejected_reason = CASE WHEN normalized_decision = 'rejected' THEN trim(_reason) ELSE NULL END
  WHERE id = _budget_id
  RETURNING * INTO budget;

  PERFORM public.finance_set_approval_work_item_status(budget.work_item_id, normalized_decision::public.work_item_status);
  PERFORM public.finance_log_audit_event('budget', budget.id, normalized_decision, jsonb_build_object('reason', _reason));
  PERFORM public.finance_queue_workflow_notifications(
    'budget', budget.id, budget.work_item_id, normalized_decision,
    jsonb_build_object('name', budget.name, 'fiscal_year', budget.fiscal_year, 'reason', _reason)
  );
  RETURN budget;
END;
$$;

-- ---------------------------------------------------------------------------
-- Function and table hardening
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_finance_export(
  _report_type text,
  _filters jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Finance report access required';
  END IF;
  INSERT INTO public.finance_export_log (report_type, filters_json, exported_by_user_id)
  VALUES (_report_type, COALESCE(_filters, '{}'::jsonb), auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_log_audit_event(
  _entity_type text,
  _entity_id uuid,
  _action text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_finance_ledger() THEN
    RAISE EXCEPTION 'Finance access required';
  END IF;
  INSERT INTO public.finance_audit_events (entity_type, entity_id, action, actor_user_id, metadata_json)
  VALUES (_entity_type, _entity_id, _action, auth.uid(), COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;

-- Read-only reports should honor the caller's RLS policies.
ALTER FUNCTION public.finance_trial_balance_report(date, date, uuid, uuid, uuid, boolean) SECURITY INVOKER;
ALTER FUNCTION public.finance_general_ledger_report(uuid, date, date, uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.finance_validate_trial_balance(date, date) SECURITY INVOKER;
ALTER FUNCTION public.finance_statement_of_financial_position(date, text) SECURITY INVOKER;
ALTER FUNCTION public.finance_statement_of_activities(date, date, text) SECURITY INVOKER;
ALTER FUNCTION public.finance_statement_of_cash_flows(date, date) SECURITY INVOKER;
ALTER FUNCTION public.finance_budget_vs_actual_report(uuid, date, date) SECURITY INVOKER;
ALTER FUNCTION public.finance_grant_financial_report(uuid, date, date) SECURITY INVOKER;
ALTER FUNCTION public.finance_functional_expense_report(date, date) SECURITY INVOKER;
ALTER FUNCTION public.finance_restricted_fund_report(date) SECURITY INVOKER;
ALTER FUNCTION public.finance_ngo_subledger_balance(uuid, date) SECURITY INVOKER;
ALTER FUNCTION public.finance_bank_account_ledger_balance(uuid) SECURITY INVOKER;
ALTER FUNCTION public.finance_bank_account_book_balance(uuid, date) SECURITY INVOKER;
ALTER FUNCTION public.finance_journal_entry_has_receipt(uuid) SECURITY INVOKER;
ALTER FUNCTION public.finance_calculate_admin_fee(numeric, uuid, uuid) SECURITY INVOKER;

-- RLS is mandatory for every public finance table, including tables added by
-- older migrations that may have been deployed before the policies landed.
DO $$
DECLARE
  finance_table record;
BEGIN
  FOR finance_table IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'finance\_%' ESCAPE '\'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', finance_table.schemaname, finance_table.tablename);
  END LOOP;
END;
$$;

-- PostgreSQL grants EXECUTE to PUBLIC for new functions by default. Remove
-- that implicit path for all Finance RPCs and authority helpers.
DO $$
DECLARE
  finance_function record;
BEGIN
  FOR finance_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'finance\_%' ESCAPE '\'
        OR p.proname LIKE '%\_finance\_%' ESCAPE '\'
        OR p.proname IN (
          'is_finance_staff', 'is_finance_ledger_manager', 'is_finance_auditor',
          'can_read_finance_ledger', 'can_write_finance_drafts',
          'get_finance_access_capabilities', 'log_finance_export',
          'save_purchase_request', 'submit_purchase_request', 'review_purchase_request'
        )
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', finance_function.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', finance_function.signature);
  END LOOP;
END;
$$;

-- Explicit application surface. Internal helper/trigger functions remain
-- owner-only and therefore cannot be invoked through PostgREST.
GRANT EXECUTE ON FUNCTION public.is_finance_ledger_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_finance_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_finance_auditor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_finance_ledger() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_finance_drafts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_access_capabilities() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_finance_export(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_log_audit_event(text, uuid, text, jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.save_finance_expense_request(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_finance_expense_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_finance_expense_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_finance_expense_request_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_purchase_request(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_purchase_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_purchase_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_finance_budget(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_finance_budget(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_finance_budget(uuid, text, text) TO authenticated;

-- Re-grant all existing public Finance application RPCs after removing PUBLIC.
GRANT EXECUTE ON FUNCTION public.post_finance_journal_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_finance_journal_entry(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_finance_journal_entry(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_bank_account_ledger_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_journal_entry_has_receipt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_finance_bill(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_finance_bill(uuid, numeric, uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_finance_bill(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_resolve_accounts_payable_account_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_finance_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_finance_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_finance_deposit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_calculate_admin_fee(numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_finance_bank_reconciliation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_finance_journal_entry(uuid, date, text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_finance_journal_entry(uuid, date, text, text, uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_finance_journal_accounts(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_open_fiscal_period(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_finance_fiscal_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_finance_fiscal_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_finance_fiscal_period(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_finance_opening_balance(uuid, uuid, numeric, numeric, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_trial_balance_report(date, date, uuid, uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_general_ledger_report(uuid, date, date, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_validate_trial_balance(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_financial_position(date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_activities(date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_statement_of_cash_flows(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_bank_account_book_balance(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_finance_bank_reconciliation_balances(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_finance_invoice_payment(uuid, date, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_off_finance_invoice(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_finance_pass_through_request(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_ngo_subledger_balance(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_budget_vs_actual_report(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_grant_financial_report(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_functional_expense_report(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_restricted_fund_report(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_finance_year_end_package(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_finance_pass_through_request(uuid, numeric, uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_finance_report_snapshot(text, text, jsonb, jsonb) TO authenticated;
