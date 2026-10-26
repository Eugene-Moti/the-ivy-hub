-- OPTIONAL: every 5 minutes, retry sales-person notifications that are still queued or failed (< 3 attempts).
-- The app already sends right after each walk-in is saved; this catches anything left behind
-- (e.g. the browser closed before it called the function).
--
-- 1. Dashboard → Database → Extensions: enable pg_cron and pg_net.
-- 2. Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> below, then run this in the SQL editor.
--    (Store the key in Vault instead of inline if you prefer: vault.create_secret(...).)

select cron.schedule(
  'ivy-hub-notification-sweep',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-walk-in',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'),
    body := '{"sweep": true}'::jsonb
  );
  $$
);

-- To stop it:  select cron.unschedule('ivy-hub-notification-sweep');
