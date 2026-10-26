-- OPTIONAL sample data for trying the live system before entering real details:
-- 3 projects with unit types and 7 team members with placeholder (+2547000001xx) numbers.
-- Load it with `npm run db:migrate -- --samples`. Rename, deactivate or archive it in the app later.

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
