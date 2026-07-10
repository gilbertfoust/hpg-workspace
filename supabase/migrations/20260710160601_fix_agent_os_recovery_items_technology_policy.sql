-- Keep the recovery-item update policy aligned with the caller-authorized RPC
-- without depending on the restricted agent_os_department_id helper.

drop policy if exists "Technology can update recovery items" on public.agent_os_recovery_items;

create policy "Technology can update recovery items"
  on public.agent_os_recovery_items for update to authenticated
  using (
    (select public.is_super_admin())
    or (select public.get_my_department()) = (
      select d.id
      from public.departments d
      where d.module = 'technology'
        and d.is_active is true
      order by d.created_at asc
      limit 1
    )
  )
  with check (
    (select public.is_super_admin())
    or (select public.get_my_department()) = (
      select d.id
      from public.departments d
      where d.module = 'technology'
        and d.is_active is true
      order by d.created_at asc
      limit 1
    )
  );
