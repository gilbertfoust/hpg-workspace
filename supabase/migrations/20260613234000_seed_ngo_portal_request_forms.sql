-- Seed external NGO portal request forms.

insert into public.form_templates (name, module, description, schema_json, mapping_json, is_active, version, form_audience, intake_module)
values
(
  'NGO Support Request',
  'ngo_coordination',
  'For NGO users to request help from HPG. NGO Coordination reviews and routes the request to the correct department.',
  '{"fields":[{"name":"request_type","type":"select","label":"What type of support do you need?","required":true,"options":["Finance","Legal/Compliance","Development/Fundraising","Operations","Program Support","Marketing/Communications","Technology","Other"]},{"name":"urgency","type":"select","label":"Urgency","required":true,"options":["Low","Medium","High","Urgent"]},{"name":"summary","type":"text","label":"Short Summary","required":true},{"name":"details","type":"textarea","label":"Describe the support needed","required":true},{"name":"preferred_contact","type":"text","label":"Best contact person for follow-up","required":false}]}',
  '{"createWorkItem":true,"workItemType":"ngo_support_request","priorityField":"urgency","titleField":"summary","descriptionField":"details","defaultModule":"ngo_coordination"}',
  true,
  1,
  'ngo_portal',
  'ngo_coordination'
),
(
  'NGO Receipt Submission',
  'ngo_coordination',
  'For NGO users to submit receipt information or reimbursement/support documentation to NGO Coordination for review and routing.',
  '{"fields":[{"name":"receipt_purpose","type":"text","label":"Purpose of Receipt","required":true},{"name":"amount","type":"number","label":"Amount","required":true},{"name":"currency","type":"select","label":"Currency","required":true,"options":["USD","MXN","EUR","GBP","KES","UGX","RWF","PHP","Other"]},{"name":"expense_date","type":"date","label":"Expense Date","required":true},{"name":"department_requested","type":"select","label":"Which area is this related to?","required":true,"options":["Finance","Program","Operations","Development","Legal/Compliance","Other"]},{"name":"notes","type":"textarea","label":"Notes / Explanation","required":false}]}',
  '{"createWorkItem":true,"workItemType":"ngo_receipt_submission","titleField":"receipt_purpose","descriptionField":"notes","defaultModule":"ngo_coordination"}',
  true,
  1,
  'ngo_portal',
  'ngo_coordination'
)
on conflict do nothing;
