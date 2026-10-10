-- APNs / FCM device tokens for remote push delivery.
-- Written and read only by taskzm-database-function (service role); clients never query it directly.

CREATE TABLE IF NOT EXISTS public.push_device_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  apns_environment TEXT NULL CHECK (apns_environment IN ('production', 'sandbox')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user_id ON public.push_device_tokens(user_id);

ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated roles have no access; the edge function uses the service role.

CREATE OR REPLACE FUNCTION public.update_push_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_push_device_tokens_updated_at ON public.push_device_tokens;
CREATE TRIGGER update_push_device_tokens_updated_at
  BEFORE UPDATE ON public.push_device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_push_device_tokens_updated_at();

COMMENT ON TABLE public.push_device_tokens IS 'Native push device tokens, per-device reminder preferences, and timezone';

-- Dispatch due-soon / overdue pushes every 5 minutes.
-- Requires two Vault secrets (Dashboard → Project Settings → Vault):
--   taskzm_function_url      e.g. https://<project-ref>.supabase.co/functions/v1/taskzm-database-function
--   taskzm_push_cron_secret  same value as the PUSH_CRON_SECRET edge function secret
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('taskzm-push-dispatch')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'taskzm-push-dispatch');

SELECT cron.schedule(
  'taskzm-push-dispatch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'taskzm_function_url') || '/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'taskzm_push_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
