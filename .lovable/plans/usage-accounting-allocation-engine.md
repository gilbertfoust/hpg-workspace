# Usage Accounting & Allocation Engine — Full Plan

## 1. Migration Plan

### Phase 1: Core Tables

```sql
-- A) cost_centers
CREATE TABLE public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid REFERENCES public.ngos(id),
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL, -- validated by trigger
  parent_cost_center_id uuid REFERENCES public.cost_centers(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(code)
);

-- Trigger: validate type IN ('ngo','department','program','grant','country_hub','admin','shared_service')
-- Trigger: update_updated_at_column

-- B) usage_sources
CREATE TABLE public.usage_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL, -- validated by trigger
  source_table text,
  source_reference_id uuid,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Trigger: validate type IN ('staff_time','procurement','inventory','asset','subscription','travel','facility','contractor','other')

-- C) usage_entries
CREATE TABLE public.usage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid REFERENCES public.ngos(id),
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id),
  cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id),
  usage_source_id uuid NOT NULL REFERENCES public.usage_sources(id),
  quantity numeric NOT NULL DEFAULT 0,
  unit_type text NOT NULL, -- validated by trigger
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  usage_date date NOT NULL,
  description text DEFAULT '',
  source_reference_type text,
  source_reference_id uuid,
  submitted_by_user_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'draft', -- validated by trigger
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger: validate unit_type IN ('hours','units','licenses','miles','days','amount','other')
-- Trigger: validate status IN ('draft','pending_review','approved','allocated')
-- Trigger: update_updated_at_column

-- D) allocation_rules
CREATE TABLE public.allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  basis_type text NOT NULL, -- validated by trigger
  source_cost_center_id uuid REFERENCES public.cost_centers(id),
  target_scope_type text NOT NULL, -- validated by trigger
  rule_config_json jsonb DEFAULT '{}',
  offset_account_id uuid REFERENCES public.accounts(id),
  expense_account_id uuid REFERENCES public.accounts(id),
  effective_start_date date NOT NULL,
  effective_end_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger: validate basis_type IN ('hours','headcount','units','flat_percent','transaction_count','revenue_share','square_footage','custom')
-- Trigger: validate target_scope_type IN ('ngo','program','grant','department','country_hub')
-- Trigger: update_updated_at_column

-- E) allocation_runs
CREATE TABLE public.allocation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- validated by trigger
  notes text DEFAULT '',
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  posted_at timestamptz
);

-- Trigger: validate status IN ('draft','preview','approved','posted','cancelled')

-- F) allocation_results
CREATE TABLE public.allocation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_run_id uuid NOT NULL REFERENCES public.allocation_runs(id) ON DELETE CASCADE,
  allocation_rule_id uuid NOT NULL REFERENCES public.allocation_rules(id),
  source_usage_entry_id uuid NOT NULL REFERENCES public.usage_entries(id),
  source_cost_center_id uuid REFERENCES public.cost_centers(id),
  target_cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id),
  allocated_amount numeric NOT NULL DEFAULT 0,
  journal_transaction_id uuid REFERENCES public.transactions(id),
  details_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- G) internal_charges
CREATE TABLE public.internal_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id),
  to_cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id),
  fiscal_period_id uuid NOT NULL REFERENCES public.fiscal_periods(id),
  description text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', -- validated by trigger
  journal_transaction_id uuid REFERENCES public.transactions(id),
  created_at timestamptz DEFAULT now()
);

-- Trigger: validate status IN ('draft','approved','posted')

-- H) grant_restriction_rules
CREATE TABLE public.grant_restriction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_application_id uuid REFERENCES public.grant_applications(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  allowed_account_ids_json jsonb DEFAULT '[]',
  restricted_categories_json jsonb DEFAULT '[]',
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### Phase 2: Indexes

```sql
CREATE INDEX idx_usage_entries_period ON public.usage_entries(fiscal_period_id);
CREATE INDEX idx_usage_entries_cost_center ON public.usage_entries(cost_center_id);
CREATE INDEX idx_usage_entries_status ON public.usage_entries(status);
CREATE INDEX idx_allocation_results_run ON public.allocation_results(allocation_run_id);
CREATE INDEX idx_internal_charges_period ON public.internal_charges(fiscal_period_id);
CREATE INDEX idx_cost_centers_type ON public.cost_centers(type);
```

### Phase 3: RLS Policies

All tables use the existing `is_internal_user()` function for authenticated access:

```sql
-- Pattern for each table:
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users full access" ON public.<table>
  FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());
```

For `usage_entries` and `allocation_results` with NGO scoping:

```sql
CREATE POLICY "NGO-scoped read" ON public.usage_entries
  FOR SELECT TO authenticated
  USING (
    public.is_internal_user() OR
    (ngo_id IS NOT NULL AND public.has_ngo_access(ngo_id))
  );
```

---

## 2. Component Tree

```
src/components/usage-accounting/
├── CostCentersTable.tsx          — CRUD table for cost centers with hierarchy display
├── CostCenterForm.tsx            — Create/edit cost center dialog
├── UsageEntryForm.tsx            — Form to log usage (manual or linked from source)
├── UsageEntriesTable.tsx         — Filterable table of usage entries
├── UsageSummaryCards.tsx          — KPI cards: total usage, by type, pending review
├── AllocationRuleBuilder.tsx     — Form to define allocation rules with config editor
├── AllocationRulesTable.tsx      — List of active/inactive rules
├── AllocationRunPreview.tsx      — Preview allocation results before posting
├── AllocationRunDialog.tsx       — Create/manage allocation run
├── AllocationResultsTable.tsx    — Results breakdown per run
├── InternalChargeForm.tsx        — Create chargeback between cost centers
├── InternalChargesTable.tsx      — List of internal charges with status
├── RestrictionCheckPanel.tsx     — Shows grant restrictions & validation warnings
├── UsageReportFilters.tsx        — Filter bar for usage reports
└── UsageReportChart.tsx          — Recharts visualization of usage/allocation data
```

---

## 3. Routing Structure

```
/financial-hub/cost-centers       → CostCentersPage
/financial-hub/usage              → UsageEntriesPage
/financial-hub/allocations        → AllocationsPage (rules + runs)
/financial-hub/chargebacks        → ChargebacksPage
/financial-hub/usage/reports      → UsageReportsPage
```

### Sidebar Addition (under Financial Hub section)

```
Financial Hub
  ├── ... (existing items)
  ├── Cost Centers        (/financial-hub/cost-centers)
  ├── Usage Tracking      (/financial-hub/usage)
  ├── Allocations         (/financial-hub/allocations)
  ├── Chargebacks         (/financial-hub/chargebacks)
  └── Usage Reports       (/financial-hub/usage/reports)
```

---

## 4. End-to-End Usage Accounting Workflow

### Step 1: Define Cost Centers
Admin creates cost centers representing NGOs, departments, programs, grants, country hubs, and shared services (e.g., "HPG IT", "HPG Finance", "Nairobi Hub"). Cost centers form a hierarchy via `parent_cost_center_id`.

### Step 2: Define Usage Sources
System or admin registers usage source types (e.g., "Staff Timesheets", "Procurement POs", "Fleet Mileage"). These map to existing ERP source tables.

### Step 3: Log Usage Entries
Usage entries are created either:
- **Manually**: Staff logs hours, facility usage, travel, etc.
- **Automatically**: Hooks pull from timesheets, POs, inventory movements, asset depreciation, etc.

Each entry records: quantity × unit_cost = total_cost, tagged to a cost center, fiscal period, and usage source.

### Step 4: Define Allocation Rules
Admin creates rules that determine how shared costs are distributed:
- **Basis**: hours, headcount, flat %, revenue share, sq footage, etc.
- **Source**: Which cost center's costs to allocate (e.g., "HPG IT")
- **Targets**: Scope type (e.g., distribute to all NGOs by headcount)
- **Accounts**: Which GL accounts to debit (expense) and credit (offset)
- **Config JSON**: Stores percentages, weights, or custom formulas

### Step 5: Run Allocation
User creates an **allocation run** for a fiscal period:
1. **Draft**: Select rules to include
2. **Preview**: System calculates `allocation_results` showing each source entry → target cost center with allocated amount. No ledger impact yet.
3. **Approve**: Manager reviews preview
4. **Post**: System generates `transactions` + `journal_entries` in the ledger. Each result row gets a `journal_transaction_id`. Run status → "posted", `posted_at` set.

### Step 6: Internal Chargebacks
For ad-hoc charges between cost centers (e.g., IT charging an NGO for a server):
1. Create internal charge (from → to cost center, amount)
2. Approve
3. Post → creates ledger transaction

### Step 7: Grant Restriction Enforcement
Before posting allocations:
- System checks `grant_restriction_rules` for target cost centers linked to grants
- If an allocation targets a restricted account/category, the system warns or blocks
- RestrictionCheckPanel displays violations in the AllocationRunPreview

### Step 8: Reporting
Usage Reports page aggregates:
- Total usage by cost center, source type, period
- Allocation summaries by target
- Chargeback history
- Trend charts via Recharts

---

## 5. How Allocation Posting Creates Journal Entries

When an allocation run is posted:

```
For each allocation_result row:
  1. Create a transaction:
     - ngo_id = target cost center's ngo_id (or source's)
     - fiscal_period_id = run's fiscal_period_id
     - description = "Allocation: {rule.name} → {target_cost_center.name}"
     
  2. Create journal entries:
     - DEBIT: expense_account_id (from allocation_rule) for allocated_amount
     - CREDIT: offset_account_id (from allocation_rule) for allocated_amount
     
  3. Link: allocation_result.journal_transaction_id = transaction.id
  
  4. Update usage_entry status → 'allocated'
```

**Period lock check**: Before posting, verify `fiscal_periods.is_locked = false`. If locked, block with error.

**Balance guarantee**: Each transaction always has equal debits and credits (enforced by existing `validate_journal_balance` trigger).

---

## 6. Integration Map

### HR → Usage Entries
- **Source**: `timesheets` (approved entries)
- **Mapping**: timesheet hours × staff hourly rate → usage_entry
- **Cost Center**: Determined by staff's department or assigned program
- **Usage Source type**: `staff_time`
- **Trigger**: On timesheet approval, optionally auto-create usage entries

### Procurement → Usage Entries
- **Source**: `purchase_orders` and `vendor_invoices` (approved/paid)
- **Mapping**: PO/invoice line items → usage_entries
- **Cost Center**: From PO's requesting department or shared-service pool
- **Usage Source type**: `procurement`
- **Trigger**: On PO receipt or invoice approval

### Inventory → Usage Entries
- **Source**: `stock_movements` (type = 'out' or 'adjustment')
- **Mapping**: quantity × item unit cost → usage_entry
- **Cost Center**: Destination department/program
- **Usage Source type**: `inventory`
- **Trigger**: On stock movement creation

### Assets → Usage Entries
- **Source**: `asset_depreciation` and `asset_maintenance`
- **Mapping**: depreciation_amount or maintenance cost → usage_entry
- **Cost Center**: Asset's assigned cost center (via asset location or department)
- **Usage Source type**: `asset`
- **Trigger**: On depreciation recording or maintenance completion

### Grants → Cost Centers & Restrictions
- **Mapping**: Each `grant_application` (awarded) becomes a cost center of type `grant`
- **Restrictions**: `grant_restriction_rules` define which accounts and categories are allowed
- **Integration**: Allocation preview checks restrictions before posting

### Existing Ledger
- **Allocation posting** creates standard `transactions` + `journal_entries`
- **Trial balance** automatically reflects allocated costs
- **Financial statements** include allocated expenses in their respective cost centers
- **Reconciliation** can match allocation transactions

### Controller Hub
- **Dashboard**: Aggregates usage and allocation data across all NGOs
- **Risk scoring**: High unallocated costs or restriction violations feed into risk scores
- **Consolidation**: Allocation results roll up into consolidated views

---

## Implementation Order (when building)

1. **Migration**: Create all 8 tables + triggers + indexes + RLS
2. **Hooks**: `useCostCenters`, `useUsageSources`, `useUsageEntries`, `useAllocationRules`, `useAllocationRuns`, `useAllocationResults`, `useInternalCharges`, `useGrantRestrictionRules`
3. **Cost Centers page**: Table + CRUD
4. **Usage Entries page**: Table + form + summary cards
5. **Allocation Rules page**: Builder + table
6. **Allocation Runs page**: Create run → preview → approve → post flow
7. **Chargebacks page**: Internal charges table + form
8. **Usage Reports page**: Filters + charts
9. **Integration hooks**: Auto-generation from HR/procurement/inventory/assets
10. **Restriction enforcement**: Grant restriction check in allocation preview
11. **Sidebar + routing**: Wire into App.tsx and AppSidebar.tsx
