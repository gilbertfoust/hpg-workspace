-- Allow hard-delete of draft journal entries only (posted entries must void/reverse)

CREATE OR REPLACE FUNCTION public.finance_guard_posted_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Journal entries cannot be hard-deleted. Void or reverse instead.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IN ('posted', 'voided', 'reversed') THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'posted' AND NEW.status IN ('voided', 'reversed'))
       ) THEN
      RAISE EXCEPTION 'Posted journal entries cannot be edited directly. Use void or reverse workflows.';
    END IF;

    IF NEW.entry_date IS DISTINCT FROM OLD.entry_date
       OR NEW.memo IS DISTINCT FROM OLD.memo
       OR NEW.entry_number IS DISTINCT FROM OLD.entry_number
       OR NEW.source_type IS DISTINCT FROM OLD.source_type
       OR NEW.source_id IS DISTINCT FROM OLD.source_id
       OR NEW.reversal_of_entry_id IS DISTINCT FROM OLD.reversal_of_entry_id
       OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
       OR NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id
       OR NEW.posted_at IS DISTINCT FROM OLD.posted_at THEN
      IF OLD.status = 'posted' AND NEW.status IN ('voided', 'reversed') THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'Posted journal entries cannot be edited directly.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
