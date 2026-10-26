-- Sample lists for a fresh database. Everything here is editable or replaceable in Admin → Settings / Team.
-- User accounts are created by `npm run db:seed-users` (they need Neon Auth accounts, not just rows).
-- Safe to re-run: existing rows are left alone.

update public.app_settings
set company_name = 'The Ivy Group', working_days = '{1,2,3,4,5,6}', open_time = '09:00', close_time = '17:30'
where id = 1;

insert into public.projects (id, name, sort_order) values
  ('11111111-0000-4000-8000-000000000001', 'Ivy Gardens', 1),
  ('11111111-0000-4000-8000-000000000002', 'Ivy Heights', 2),
  ('11111111-0000-4000-8000-000000000003', 'Ivy Ridge Plots', 3)
on conflict (id) do nothing;

insert into public.unit_types (id, project_id, name, sort_order) values
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'Studio', 1),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', '1 Bedroom', 2),
  ('22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', '2 Bedroom', 3),
  ('22222222-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000001', '3 Bedroom', 4),
  ('22222222-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000002', '2 Bedroom', 1),
  ('22222222-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000002', '3 Bedroom', 2),
  ('22222222-0000-4000-8000-000000000007', '11111111-0000-4000-8000-000000000002', 'Maisonette', 3),
  ('22222222-0000-4000-8000-000000000008', '11111111-0000-4000-8000-000000000003', '1/8 Acre Plot', 1),
  ('22222222-0000-4000-8000-000000000009', '11111111-0000-4000-8000-000000000003', '1/4 Acre Plot', 2)
on conflict (id) do nothing;

insert into public.lead_sources (id, name, icon, kind, sort_order) values
  ('33333333-0000-4000-8000-000000000001', 'Website', 'globe', 'standard', 1),
  ('33333333-0000-4000-8000-000000000002', 'Social Media', 'share', 'standard', 2),
  ('33333333-0000-4000-8000-000000000003', 'Google Business Profile', 'map-pin', 'standard', 3),
  ('33333333-0000-4000-8000-000000000004', 'WhatsApp Broadcast', 'whatsapp', 'standard', 4),
  ('33333333-0000-4000-8000-000000000005', 'Phone Call', 'phone', 'standard', 5),
  ('33333333-0000-4000-8000-000000000006', 'Expo', 'tent', 'standard', 6),
  ('33333333-0000-4000-8000-000000000007', 'Promotional Email', 'envelope', 'standard', 7),
  ('33333333-0000-4000-8000-000000000008', 'Sales Person', 'handshake', 'sales_person', 8),
  ('33333333-0000-4000-8000-000000000009', 'Other', 'dots', 'other', 9)
on conflict (id) do nothing;

-- Sample team: replace the phone numbers and emails with real ones before going live.
insert into public.team_members (id, full_name, phone, whatsapp, email, title, branch, is_sales_person) values
  ('44444444-0000-4000-8000-000000000001', 'Brian Otieno', '+254700000101', '+254700000101', 'brian@example.com', 'Sales Executive', 'Westlands', true),
  ('44444444-0000-4000-8000-000000000002', 'Faith Njeri', '+254700000102', '+254700000102', 'faith@example.com', 'Sales Executive', 'Westlands', true),
  ('44444444-0000-4000-8000-000000000003', 'Kevin Mutua', '+254700000103', '+254700000103', 'kevin@example.com', 'Sales Executive', 'Kilimani', true),
  ('44444444-0000-4000-8000-000000000004', 'Lilian Chebet', '+254700000104', '+254700000104', 'lilian@example.com', 'Senior Sales Executive', 'Kilimani', true),
  ('44444444-0000-4000-8000-000000000005', 'Samuel Kiprono', '+254700000105', '+254700000105', 'samuel@example.com', 'Diaspora Sales', 'Diaspora desk', true),
  ('44444444-0000-4000-8000-000000000006', 'Daniel Mwangi', '+254700000106', '+254700000106', 'daniel@example.com', 'Chief Executive Officer', 'Head office', false),
  ('44444444-0000-4000-8000-000000000007', 'Agnes Wambui', '+254700000107', '+254700000107', 'agnes@example.com', 'Accounts', 'Head office', false)
on conflict (id) do nothing;
