-- Fixed assets, multi-currency, vendor tax reporting, check controls, and
-- investment accounting. All posting functions create balanced journal entries.

alter table public.assets
  add column if not exists finance_asset_account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists depreciation_expense_account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists accumulated_depreciation_account_id uuid references public.finance_accounts(id) on delete set null;
alter table public.asset_depreciation
  add column if not exists journal_entry_id uuid references public.finance_journal_entries(id) on delete set null,
  add column if not exists posted_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists posted_at timestamptz;
create unique index if not exists asset_depreciation_asset_period_unique on public.asset_depreciation(asset_id,period_date);
create index if not exists asset_depreciation_journal_idx on public.asset_depreciation(journal_entry_id);

create table public.finance_exchange_rates(
  id uuid primary key default gen_random_uuid(),rate_date date not null,base_currency text not null check(base_currency~'^[A-Z]{3}$'),
  quote_currency text not null check(quote_currency~'^[A-Z]{3}$'),rate numeric(20,8) not null check(rate>0),
  source text not null default 'manual',is_locked boolean not null default false,created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(rate_date,base_currency,quote_currency,source),check(base_currency<>quote_currency)
);
alter table public.finance_journal_entries add column if not exists base_currency text not null default 'USD',add column if not exists transaction_currency text,add column if not exists exchange_rate numeric(20,8);
alter table public.finance_journal_lines add column if not exists original_currency text,add column if not exists original_debit numeric(18,2),add column if not exists original_credit numeric(18,2),add column if not exists line_exchange_rate numeric(20,8);

create table public.finance_vendor_tax_profiles(
  vendor_id uuid primary key references public.finance_vendors(id) on delete cascade,
  tax_classification text check(tax_classification in ('individual','sole_proprietor','c_corporation','s_corporation','partnership','llc','trust','nonprofit','government','foreign','other')),
  tin_type text check(tin_type in ('ssn','ein','itin','foreign')),
  tin_last_four text check(tin_last_four is null or tin_last_four~'^[0-9]{4}$'),
  w9_document_id uuid references public.documents(id) on delete set null,
  w8_document_id uuid references public.documents(id) on delete set null,
  form_1099_eligible boolean not null default false,
  form_1099_type text default '1099-NEC' check(form_1099_type in ('1099-NEC','1099-MISC','1099-INT','1099-DIV','none')),
  backup_withholding boolean not null default false,
  country_code text default 'US' check(country_code~'^[A-Z]{2}$'),
  verified_by_user_id uuid references public.profiles(id) on delete set null,verified_at timestamptz,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.finance_vendor_tax_years(
  id uuid primary key default gen_random_uuid(),vendor_id uuid not null references public.finance_vendors(id) on delete cascade,
  ngo_id uuid not null references public.ngos(id) on delete cascade,tax_year integer not null,
  reportable_amount numeric(18,2) not null default 0,withholding_amount numeric(18,2) not null default 0,
  form_type text not null default '1099-NEC',status text not null default 'draft' check(status in ('draft','reviewed','exported','filed','corrected','not_required')),
  recipient_copy_document_id uuid references public.documents(id) on delete set null,filing_reference text,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(vendor_id,ngo_id,tax_year,form_type)
);

create table public.finance_check_stock(
  id uuid primary key default gen_random_uuid(),bank_account_id uuid not null references public.finance_bank_accounts(id) on delete cascade,
  stock_name text not null,starting_number bigint not null check(starting_number>0),ending_number bigint not null check(ending_number>=starting_number),
  next_number bigint not null check(next_number>=starting_number),status text not null default 'active' check(status in ('active','exhausted','locked','retired')),
  created_by_user_id uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.finance_checks(
  id uuid primary key default gen_random_uuid(),ngo_id uuid not null references public.ngos(id) on delete restrict,
  payment_id uuid not null unique references public.finance_payments(id) on delete restrict,check_stock_id uuid not null references public.finance_check_stock(id) on delete restrict,
  check_number bigint not null,payee_name text not null,amount numeric(18,2) not null check(amount>0),check_date date not null,memo text,
  status text not null default 'issued' check(status in ('issued','printed','mailed','cleared','voided','stopped')),
  print_document_id uuid references public.documents(id) on delete set null,printed_by_user_id uuid references public.profiles(id) on delete set null,printed_at timestamptz,
  cleared_at timestamptz,voided_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(check_stock_id,check_number)
);

create table public.finance_investment_accounts(
  id uuid primary key default gen_random_uuid(),ngo_id uuid not null references public.ngos(id) on delete cascade,
  name text not null,custodian text,account_mask text,base_currency text not null default 'USD',
  investment_asset_account_id uuid not null references public.finance_accounts(id) on delete restrict,
  cash_account_id uuid references public.finance_accounts(id) on delete set null,
  investment_income_account_id uuid references public.finance_accounts(id) on delete set null,
  unrealized_gain_account_id uuid references public.finance_accounts(id) on delete set null,
  unrealized_loss_account_id uuid references public.finance_accounts(id) on delete set null,
  is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.finance_investment_holdings(
  id uuid primary key default gen_random_uuid(),investment_account_id uuid not null references public.finance_investment_accounts(id) on delete cascade,
  symbol text,security_name text not null,security_type text not null default 'other',quantity numeric(24,8) not null default 0,
  cost_basis numeric(18,2) not null default 0,fair_value numeric(18,2) not null default 0,price_date date,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(investment_account_id,security_name)
);
create table public.finance_investment_valuations(
  id uuid primary key default gen_random_uuid(),investment_account_id uuid not null references public.finance_investment_accounts(id) on delete cascade,
  valuation_date date not null,total_fair_value numeric(18,2) not null,total_cost_basis numeric(18,2) not null,
  unrealized_gain_loss numeric(18,2) not null,journal_entry_id uuid references public.finance_journal_entries(id) on delete set null,
  source_document_id uuid references public.documents(id) on delete set null,created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),unique(investment_account_id,valuation_date)
);

create trigger finance_exchange_rates_updated_at before update on public.finance_exchange_rates for each row execute function public.update_updated_at_column();
create trigger finance_vendor_tax_profiles_updated_at before update on public.finance_vendor_tax_profiles for each row execute function public.update_updated_at_column();
create trigger finance_vendor_tax_years_updated_at before update on public.finance_vendor_tax_years for each row execute function public.update_updated_at_column();
create trigger finance_check_stock_updated_at before update on public.finance_check_stock for each row execute function public.update_updated_at_column();
create trigger finance_checks_updated_at before update on public.finance_checks for each row execute function public.update_updated_at_column();
create trigger finance_investment_accounts_updated_at before update on public.finance_investment_accounts for each row execute function public.update_updated_at_column();
create trigger finance_investment_holdings_updated_at before update on public.finance_investment_holdings for each row execute function public.update_updated_at_column();

alter table public.finance_exchange_rates enable row level security;alter table public.finance_vendor_tax_profiles enable row level security;alter table public.finance_vendor_tax_years enable row level security;
alter table public.finance_check_stock enable row level security;alter table public.finance_checks enable row level security;alter table public.finance_investment_accounts enable row level security;
alter table public.finance_investment_holdings enable row level security;alter table public.finance_investment_valuations enable row level security;

create policy "Finance reads exchange rates" on public.finance_exchange_rates for select to authenticated using(public.is_finance_staff());
create policy "Finance manages exchange rates" on public.finance_exchange_rates for all to authenticated using(public.is_finance_ledger_manager()) with check(public.is_finance_ledger_manager());
create policy "Finance manages vendor tax profiles" on public.finance_vendor_tax_profiles for all to authenticated using(public.is_finance_staff()) with check(public.is_finance_staff());
create policy "Finance manages vendor tax years" on public.finance_vendor_tax_years for all to authenticated using(public.is_finance_staff()) with check(public.is_finance_staff());
create policy "Finance manages check stock" on public.finance_check_stock for all to authenticated using(public.is_finance_ledger_manager()) with check(public.is_finance_ledger_manager());
create policy "Finance reads checks" on public.finance_checks for select to authenticated using(public.is_finance_staff());
create policy "Finance manages checks" on public.finance_checks for all to authenticated using(public.is_finance_ledger_manager()) with check(public.is_finance_ledger_manager());
create policy "Finance manages investment accounts" on public.finance_investment_accounts for all to authenticated using(public.is_finance_staff()) with check(public.is_finance_staff());
create policy "Finance manages investment holdings" on public.finance_investment_holdings for all to authenticated using(public.is_finance_staff()) with check(public.is_finance_staff());
create policy "Finance manages investment valuations" on public.finance_investment_valuations for all to authenticated using(public.is_finance_staff()) with check(public.is_finance_staff());

grant select,insert,update on public.finance_exchange_rates,public.finance_vendor_tax_profiles,public.finance_vendor_tax_years,public.finance_check_stock,public.finance_checks,public.finance_investment_accounts,public.finance_investment_holdings,public.finance_investment_valuations to authenticated;
grant all on public.finance_exchange_rates,public.finance_vendor_tax_profiles,public.finance_vendor_tax_years,public.finance_check_stock,public.finance_checks,public.finance_investment_accounts,public.finance_investment_holdings,public.finance_investment_valuations to service_role;

create or replace function public.post_asset_depreciation(p_asset_id uuid,p_period_date date)
returns public.asset_depreciation language plpgsql security definer set search_path=public as $$
declare asset public.assets; amount_value numeric(18,2); accumulated numeric(18,2); row_out public.asset_depreciation; entry_id uuid; period_id uuid;
begin
 if auth.uid() is null or not public.is_finance_ledger_manager() then raise exception 'Finance manager access required';end if;
 select * into asset from public.assets where id=p_asset_id for update;if asset.id is null then raise exception 'Asset not found';end if;
 if asset.depreciation_method='none' or coalesce(asset.useful_life_months,0)<=0 then raise exception 'Asset has no depreciable life';end if;
 if asset.depreciation_expense_account_id is null or asset.accumulated_depreciation_account_id is null then raise exception 'Map depreciation expense and accumulated depreciation accounts';end if;
 amount_value:=round(greatest(asset.acquisition_cost-asset.salvage_value,0)/asset.useful_life_months,2);
 select coalesce(max(d.accumulated_depreciation),0)+amount_value into accumulated from public.asset_depreciation d where d.asset_id=asset.id;
 period_id:=public.get_finance_open_fiscal_period(p_period_date,null,asset.ngo_id);
 insert into public.finance_journal_entries(entry_date,memo,source_type,source_id,status,created_by_user_id,ngo_id,fiscal_period_id)
 values(p_period_date,'Depreciation — '||asset.name,'asset_depreciation',asset.id,'draft',auth.uid(),asset.ngo_id,period_id) returning id into entry_id;
 insert into public.finance_journal_lines(journal_entry_id,account_id,debit,credit,memo,ngo_id,line_number) values
 (entry_id,asset.depreciation_expense_account_id,amount_value,0,asset.name,asset.ngo_id,1),(entry_id,asset.accumulated_depreciation_account_id,0,amount_value,asset.name,asset.ngo_id,2);
 perform public.finance_validate_journal_entity_scope(entry_id);update public.finance_journal_entries set status='posted',posted_at=now(),approved_by_user_id=auth.uid() where id=entry_id;
 insert into public.asset_depreciation(asset_id,ngo_id,period_label,period_date,depreciation_amount,accumulated_depreciation,book_value,journal_entry_id,posted_by_user_id,posted_at)
 values(asset.id,asset.ngo_id,to_char(p_period_date,'YYYY-MM'),p_period_date,amount_value,accumulated,greatest(asset.acquisition_cost-accumulated,asset.salvage_value),entry_id,auth.uid(),now()) returning * into row_out;
 return row_out;
end;$$;

create or replace function public.issue_finance_check(p_payment_id uuid,p_check_stock_id uuid,p_check_date date default current_date)
returns public.finance_checks language plpgsql security definer set search_path=public as $$
declare payment public.finance_payments;stock public.finance_check_stock;row_out public.finance_checks;
begin
 if auth.uid() is null or not public.is_finance_ledger_manager() then raise exception 'Finance manager access required';end if;
 select * into payment from public.finance_payments where id=p_payment_id and status='posted' for update;if payment.id is null or payment.payment_method<>'check' then raise exception 'Select a posted check payment';end if;
 select * into stock from public.finance_check_stock where id=p_check_stock_id and status='active' for update;if stock.id is null or stock.next_number>stock.ending_number then raise exception 'Check stock is unavailable';end if;
 insert into public.finance_checks(ngo_id,payment_id,check_stock_id,check_number,payee_name,amount,check_date,memo)
 values(payment.ngo_id,payment.id,stock.id,stock.next_number,payment.payee_name,payment.amount,coalesce(p_check_date,current_date),payment.memo) returning * into row_out;
 update public.finance_check_stock set next_number=next_number+1,status=case when next_number+1>ending_number then 'exhausted' else status end where id=stock.id;
 update public.finance_payments set reference_number=row_out.check_number::text where id=payment.id;
 return row_out;
end;$$;

create or replace function public.refresh_vendor_tax_year(p_vendor_id uuid,p_ngo_id uuid,p_tax_year integer)
returns public.finance_vendor_tax_years language plpgsql security definer set search_path=public as $$
declare amount_value numeric(18,2);profile public.finance_vendor_tax_profiles;row_out public.finance_vendor_tax_years;
begin
 if auth.uid() is null or not public.is_finance_staff() then raise exception 'Finance access required';end if;
 select * into profile from public.finance_vendor_tax_profiles where vendor_id=p_vendor_id;
 select round(coalesce(sum(bp.amount),0),2) into amount_value from public.finance_bill_payments bp join public.finance_bills b on b.id=bp.bill_id
 where b.vendor_id=p_vendor_id and b.ngo_id=p_ngo_id and extract(year from bp.payment_date)::integer=p_tax_year;
 insert into public.finance_vendor_tax_years(vendor_id,ngo_id,tax_year,reportable_amount,form_type,status)
 values(p_vendor_id,p_ngo_id,p_tax_year,amount_value,coalesce(profile.form_1099_type,'1099-NEC'),case when coalesce(profile.form_1099_eligible,false) and amount_value>=600 then 'draft' else 'not_required' end)
 on conflict(vendor_id,ngo_id,tax_year,form_type) do update set reportable_amount=excluded.reportable_amount,status=case when public.finance_vendor_tax_years.status='filed' then 'filed' else excluded.status end,updated_at=now()
 returning * into row_out;return row_out;
end;$$;

create or replace function public.post_investment_valuation(p_investment_account_id uuid,p_valuation_date date,p_total_fair_value numeric,p_source_document_id uuid default null)
returns public.finance_investment_valuations language plpgsql security definer set search_path=public as $$
declare account_row public.finance_investment_accounts;prior_value numeric(18,2);cost_value numeric(18,2);delta numeric(18,2);entry_id uuid;period_id uuid;row_out public.finance_investment_valuations;offset_account uuid;
begin
 if auth.uid() is null or not public.is_finance_ledger_manager() then raise exception 'Finance manager access required';end if;
 select * into account_row from public.finance_investment_accounts where id=p_investment_account_id and is_active for update;if account_row.id is null then raise exception 'Investment account not found';end if;
 select coalesce(sum(cost_basis),0) into cost_value from public.finance_investment_holdings where investment_account_id=account_row.id;
 select total_fair_value into prior_value from public.finance_investment_valuations where investment_account_id=account_row.id order by valuation_date desc limit 1;prior_value:=coalesce(prior_value,cost_value);delta:=round(p_total_fair_value-prior_value,2);
 if delta<>0 then
  offset_account:=case when delta>0 then account_row.unrealized_gain_account_id else account_row.unrealized_loss_account_id end;if offset_account is null then raise exception 'Map unrealized gain and loss accounts';end if;
  period_id:=public.get_finance_open_fiscal_period(p_valuation_date,null,account_row.ngo_id);
  insert into public.finance_journal_entries(entry_date,memo,source_type,source_id,status,created_by_user_id,ngo_id,fiscal_period_id) values(p_valuation_date,'Investment fair-value adjustment','investment_valuation',account_row.id,'draft',auth.uid(),account_row.ngo_id,period_id) returning id into entry_id;
  if delta>0 then insert into public.finance_journal_lines(journal_entry_id,account_id,debit,credit,memo,ngo_id,line_number) values(entry_id,account_row.investment_asset_account_id,delta,0,'Fair value gain',account_row.ngo_id,1),(entry_id,offset_account,0,delta,'Unrealized gain',account_row.ngo_id,2);
  else insert into public.finance_journal_lines(journal_entry_id,account_id,debit,credit,memo,ngo_id,line_number) values(entry_id,offset_account,abs(delta),0,'Unrealized loss',account_row.ngo_id,1),(entry_id,account_row.investment_asset_account_id,0,abs(delta),'Fair value decrease',account_row.ngo_id,2);end if;
  perform public.finance_validate_journal_entity_scope(entry_id);update public.finance_journal_entries set status='posted',posted_at=now(),approved_by_user_id=auth.uid() where id=entry_id;
 end if;
 insert into public.finance_investment_valuations(investment_account_id,valuation_date,total_fair_value,total_cost_basis,unrealized_gain_loss,journal_entry_id,source_document_id,created_by_user_id)
 values(account_row.id,p_valuation_date,round(p_total_fair_value,2),round(cost_value,2),round(p_total_fair_value-cost_value,2),entry_id,p_source_document_id,auth.uid()) returning * into row_out;return row_out;
end;$$;

revoke all on function public.post_asset_depreciation(uuid,date) from public,anon;revoke all on function public.issue_finance_check(uuid,uuid,date) from public,anon;
revoke all on function public.refresh_vendor_tax_year(uuid,uuid,integer) from public,anon;revoke all on function public.post_investment_valuation(uuid,date,numeric,uuid) from public,anon;
grant execute on function public.post_asset_depreciation(uuid,date) to authenticated;grant execute on function public.issue_finance_check(uuid,uuid,date) to authenticated;
grant execute on function public.refresh_vendor_tax_year(uuid,uuid,integer) to authenticated;grant execute on function public.post_investment_valuation(uuid,date,numeric,uuid) to authenticated;
