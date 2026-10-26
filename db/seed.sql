-- Starting list for the live system: the "How did you find out about us?" options from the brief.
-- Company name and office hours already default to The Ivy Group, Mon–Sat 09:00–17:30.
-- Projects, unit types and team members are left empty on purpose: add the real ones in the app
-- (Settings → Projects, and Team). Safe to re-run: existing rows are never changed.

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
