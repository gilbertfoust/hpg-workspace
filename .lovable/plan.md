

## HPG ERP Master Plan — NetSuite-Scale Architecture

This is a massive scaffolding effort. The plan creates 10 new module folders under `src/modules/`, each with placeholder dashboards, sub-pages, types, and hooks. No new database tables yet — the scaffolding uses placeholder components that will be fleshed out module-by-module. Database tables will be created per-module when each is implemented.

### Architecture Decision

Use `src/modules/<module>/` folder structure (not `src/pages/modules/`) to cleanly separate ERP modules from existing pages. Each module exports its own pages, components, hooks, and types.

### File Structure (all new files)

```text
src/modules/
├── crm/
│   ├── pages/
│   │   ├── CRMDashboard.tsx
│   │   ├── CRMContacts.tsx
│   │   ├── CRMOrganizations.tsx
│   │   ├── CRMInteractions.tsx
│   │   └── CRMPipeline.tsx
│   ├── components/        (empty, placeholder exports)
│   └── types.ts
├── procurement/
│   ├── pages/
│   │   ├── ProcurementDashboard.tsx
│   │   ├── PurchaseRequests.tsx
│   │   ├── PurchaseOrders.tsx
│   │   ├── VendorInvoices.tsx
│   │   └── GoodsReceived.tsx
│   ├── components/
│   └── types.ts
├── grants/
│   ├── pages/
│   │   ├── GrantsDashboard.tsx
│   │   ├── GrantSearch.tsx
│   │   ├── GrantPipeline.tsx
│   │   └── GrantProfile.tsx
│   ├── components/
│   └── types.ts
├── hr/
│   ├── pages/
│   │   ├── HRModuleDashboard.tsx
│   │   ├── StaffProfiles.tsx
│   │   ├── Timesheets.tsx
│   │   ├── PTOManagement.tsx
│   │   └── PayrollExport.tsx
│   ├── components/
│   └── types.ts
├── assets/
│   ├── pages/
│   │   ├── AssetsDashboard.tsx
│   │   ├── AssetRegistry.tsx
│   │   ├── Depreciation.tsx
│   │   └── Maintenance.tsx
│   ├── components/
│   └── types.ts
├── inventory/
│   ├── pages/
│   │   ├── InventoryDashboard.tsx
│   │   ├── InventoryItems.tsx
│   │   ├── StockMovements.tsx
│   │   └── SupplyRequests.tsx
│   ├── components/
│   └── types.ts
├── revenue/
│   ├── pages/
│   │   ├── RevenueDashboard.tsx
│   │   ├── DonationTypes.tsx
│   │   ├── RecurringRevenue.tsx
│   │   └── RevenueRecognition.tsx
│   ├── components/
│   └── types.ts
├── governance/
│   ├── pages/
│   │   ├── GovernanceDashboard.tsx
│   │   ├── FXRates.tsx
│   │   ├── CountryCompliance.tsx
│   │   └── LocalizedCOA.tsx
│   ├── components/
│   └── types.ts
├── audit/
│   ├── pages/
│   │   ├── AuditDashboard.tsx
│   │   ├── AuditTrail.tsx
│   │   └── PermissionChanges.tsx
│   ├── components/
│   └── types.ts
└── controller/
    ├── pages/
    │   ├── ControllerDashboard.tsx
    │   ├── Consolidation.tsx
    │   ├── RiskScoring.tsx
    │   ├── InterNGOTransfers.tsx
    │   └── Treasury.tsx
    ├── components/
    └── types.ts
```

### Each placeholder page pattern

Every page follows this template (using `MainLayout` + a "Coming Soon" card with module-specific feature badges), reusing the existing `ModulePlaceholder` pattern but rendered inline with real route paths.

### Routing Structure (additions to App.tsx)

```text
/crm                          → CRMDashboard
/crm/contacts                 → CRMContacts
/crm/organizations            → CRMOrganizations
/crm/interactions             → CRMInteractions
/crm/pipeline                 → CRMPipeline

/procurement                  → ProcurementDashboard
/procurement/requests         → PurchaseRequests
/procurement/orders           → PurchaseOrders
/procurement/invoices         → VendorInvoices
/procurement/received         → GoodsReceived

/grants                       → GrantsDashboard
/grants/search                → GrantSearch
/grants/pipeline              → GrantPipeline
/grants/profile/:id           → GrantProfile

/erp/hr                       → HRModuleDashboard
/erp/hr/staff                 → StaffProfiles
/erp/hr/timesheets            → Timesheets
/erp/hr/pto                   → PTOManagement
/erp/hr/payroll               → PayrollExport

/assets                       → AssetsDashboard
/assets/registry              → AssetRegistry
/assets/depreciation          → Depreciation
/assets/maintenance           → Maintenance

/inventory                    → InventoryDashboard
/inventory/items              → InventoryItems
/inventory/movements          → StockMovements
/inventory/requests           → SupplyRequests

/revenue                      → RevenueDashboard
/revenue/donations            → DonationTypes
/revenue/recurring            → RecurringRevenue
/revenue/recognition          → RevenueRecognition

/governance                   → GovernanceDashboard
/governance/fx                → FXRates
/governance/compliance        → CountryCompliance
/governance/coa               → LocalizedCOA

/audit                        → AuditDashboard
/audit/trail                  → AuditTrail
/audit/permissions            → PermissionChanges

/controller                   → ControllerDashboard
/controller/consolidation     → Consolidation
/controller/risk              → RiskScoring
/controller/transfers         → InterNGOTransfers
/controller/treasury          → Treasury
```

### Sidebar Update (AppSidebar.tsx)

Add a new collapsible "ERP Modules" section below the existing "Modules" section:

```text
ERP Modules (collapsible)
  ├── CRM                  (/crm)
  ├── Procurement          (/procurement)
  ├── Grants               (/grants)
  ├── HR & Workforce       (/erp/hr)
  ├── Assets               (/assets)
  ├── Inventory            (/inventory)
  ├── Revenue              (/revenue)
  ├── Governance           (/governance)
  ├── Audit                (/audit)
  └── Controller Hub       (/controller)
```

### Database Scaffolding

**No tables created in this step.** Each module will get its own migration when implementation begins. The plan for future tables per module:

- **CRM:** `crm_organizations`, `crm_contacts`, `crm_interactions`, `crm_pipeline_stages`, `crm_deals`
- **Procurement:** `purchase_requests`, `purchase_orders`, `po_line_items`, `goods_received`, `vendor_invoices`
- **Grants:** `grant_sources`, `grant_opportunities`, `grant_applications`, `grant_saved_searches`
- **HR:** `staff_profiles`, `timesheets`, `pto_requests`, `contractors`
- **Assets:** `assets`, `asset_depreciation`, `asset_maintenance`, `asset_assignments`
- **Inventory:** `inventory_items`, `inventory_locations`, `stock_movements`, `supply_requests`
- **Revenue:** `revenue_streams`, `recurring_donations`, `revenue_recognition_schedules`
- **Governance:** `fx_rates`, `country_compliance_profiles`, `localized_coa_mappings`
- **Audit:** Extends existing `audit_log` table with additional tracking
- **Controller:** `consolidation_reports`, `ngo_risk_scores`, `inter_ngo_transfers`, `treasury_positions`

### Financial Hub Integration Notes

All modules connect to the existing Financial Hub via:
- **Procurement:** PO approval → auto-creates `transactions` + `journal_entries` (expense accounts)
- **Grants:** Award → creates income transactions; reporting pulls from trial balance
- **Revenue:** Recognition schedules create deferred revenue journal entries
- **Assets:** Depreciation creates periodic journal entries against asset/expense accounts
- **Inventory:** Consumption logs create expense transactions
- **Controller:** Consolidation aggregates trial balances across NGOs
- **Governance:** FX rates apply to multi-currency transactions
- **Audit:** Reads from existing `audit_log` table + extends it

### Implementation Steps

1. Create all ~45 placeholder page files across 10 module folders (each with consistent "Coming Soon" UI showing planned features)
2. Create 10 `types.ts` files with initial type stubs
3. Add all ~45 routes to `App.tsx`
4. Add "ERP Modules" collapsible section to `AppSidebar.tsx` with 10 top-level nav items
5. Each module dashboard shows sub-navigation cards linking to its child pages

### Technical Notes

- All pages use `MainLayout` + `ProtectedRoute` wrapper
- Placeholder pages render a consistent "Module Coming Soon" card with feature badges (reusing the pattern from `ModulePlaceholder.tsx`)
- No lazy loading in this step — can be added later for performance
- HR module routes use `/erp/hr` prefix to avoid collision with existing `/hr` route

