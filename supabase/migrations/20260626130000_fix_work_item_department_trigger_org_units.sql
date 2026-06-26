-- work_items.department_id references org_units(id), not departments(id).
-- The prior trigger looked up public.departments and caused FK violations on insert.

CREATE OR REPLACE FUNCTION public.assign_work_item_department_from_module()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dept_name text;
  sub_dept text;
BEGIN
  IF NEW.department_id IS NOT NULL OR NEW.module IS NULL THEN
    RETURN NEW;
  END IF;

  dept_name := CASE NEW.module
    WHEN 'ngo_coordination' THEN 'Program'
    WHEN 'development' THEN 'Development'
    WHEN 'finance' THEN 'Finance'
    WHEN 'operations' THEN 'Operations'
    WHEN 'marketing' THEN 'Marketing'
    WHEN 'communications' THEN 'Communications'
    WHEN 'hr' THEN 'HR'
    WHEN 'it' THEN 'IT'
    WHEN 'legal' THEN 'Legal'
    WHEN 'program' THEN 'Program'
    WHEN 'curriculum' THEN 'Program'
    WHEN 'administration' THEN 'Administration'
    WHEN 'partnership' THEN 'Partnership Development'
    ELSE NULL
  END;

  sub_dept := CASE WHEN NEW.module = 'curriculum' THEN 'Curriculum' ELSE NULL END;

  IF dept_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF sub_dept IS NOT NULL THEN
    SELECT ou.id
    INTO NEW.department_id
    FROM public.org_units ou
    WHERE ou.department_name = dept_name
      AND ou.sub_department_name = sub_dept
    LIMIT 1;
  ELSE
    SELECT ou.id
    INTO NEW.department_id
    FROM public.org_units ou
    WHERE ou.department_name = dept_name
      AND ou.sub_department_name IS NULL
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;
