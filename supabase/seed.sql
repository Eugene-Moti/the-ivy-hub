-- Sample lists for a fresh project. Everything here is editable or replaceable in Admin → Settings.
-- Users are created with scripts/create-user.mjs (they need Supabase Auth accounts, not just rows).

update public.app_settings
set company_name = 'The Ivy Group', working_days = '{1,2,3,4,5,6}', open_time = '09:00', close_time = '17:30'
where id = 1;

insert into public.projects (id, name, sort_order) values
  ('11111111-0000-4000-8000-000000000001', 'Ivy Gardens', 1),
  ('11111111-0000-4000-8000-000000000002', 'Ivy Heights', 2),
  ('11111111-0000-4000-8000-000000000003', 'Ivy Ridge Plots', 3)
on conflict (id) do nothing;

insert into public.unit_types (project_id, name, sort_order) values
  ('11111111-0000-4000-8000-000000000001', 'Studio', 1),
  ('11111111-0000-4000-8000-000000000001', '1 Bedroom', 2),
  ('11111111-0000-4000-8000-000000000001', '2 Bedroom', 3),
  ('11111111-0000-4000-8000-000000000001', '3 Bedroom', 4),
  ('11111111-0000-4000-8000-000000000002', '2 Bedroom', 1),
  ('11111111-0000-4000-8000-000000000002', '3 Bedroom', 2),
  ('11111111-0000-4000-8000-000000000002', 'Maisonette', 3),
  ('11111111-0000-4000-8000-000000000003', '1/8 Acre Plot', 1),
  ('11111111-0000-4000-8000-000000000003', '1/4 Acre Plot', 2);

insert into public.lead_sources (name, icon, kind, sort_order) values
  ('Website', 'globe', 'standard', 1),
  ('Social Media', 'share', 'standard', 2),
  ('Google Business Profile', 'map-pin', 'standard', 3),
  ('WhatsApp Broadcast', 'whatsapp', 'standard', 4),
  ('Phone Call', 'phone', 'standard', 5),
  ('Expo', 'tent', 'standard', 6),
  ('Promotional Email', 'envelope', 'standard', 7),
  ('Sales Person', 'handshake', 'sales_person', 8),
  ('Other', 'dots', 'other', 9);

-- Sample sales persons: replace the phone numbers and emails with real ones before going live.
insert into public.sales_persons (full_name, phone, whatsapp, email, team) values
  ('Brian Otieno', '+254700000101', '+254700000101', 'brian@example.com', 'Westlands'),
  ('Faith Njeri', '+254700000102', '+254700000102', 'faith@example.com', 'Westlands'),
  ('Kevin Mutua', '+254700000103', '+254700000103', 'kevin@example.com', 'Kilimani'),
  ('Lilian Chebet', '+254700000104', '+254700000104', 'lilian@example.com', 'Kilimani'),
  ('Samuel Kiprono', '+254700000105', '+254700000105', 'samuel@example.com', 'Diaspora desk');
