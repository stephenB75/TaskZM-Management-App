# Google Calendar callback "NOT_FOUND" fix

If, after approving access in Google, you see:

```json
{"code":"NOT_FOUND", "message": "Requested function was not found"}
```

then Google is redirecting to a **Supabase function that doesn’t exist or isn’t the one that handles the callback**.

## Cause

The redirect URL must point at the **deployed** Edge Function that implements the calendar callback. This project uses the function **`taskzm-database-function`**. If the URL uses a different function name (e.g. `make-server-65e6e67f`), Supabase returns NOT_FOUND and the app never receives tokens, so it keeps showing "not approved."

## Fix (two places)

Use your real Supabase project reference instead of `YOUR_PROJECT_REF` (e.g. `gflesnyfpxqhaunfskrw`).

### 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Open your **OAuth 2.0 Client ID** (Web application) used for taskZM.
3. Under **Authorized redirect URIs**:
   - **Add** (if missing):  
     `https://YOUR_PROJECT_REF.supabase.co/functions/v1/taskzm-database-function/calendar/google/callback`
   - **Remove** any URI that uses a different function name (e.g. `make-server-65e6e67f`).
4. Save.

### 2. Supabase (Edge Function secret)

The function builds the auth URL using the env var `GOOGLE_REDIRECT_URI`. It must match the URL you set in Google (and use `taskzm-database-function`):

1. Supabase Dashboard → **Project Settings** → **Edge Functions** (or **Secrets**).
2. Set:
   - **GOOGLE_REDIRECT_URI** = `https://YOUR_PROJECT_REF.supabase.co/functions/v1/taskzm-database-function/calendar/google/callback`

Redeploy the Edge Function if needed so it picks up the new secret.

## "The provided client secret is invalid"

Google returns this after you approve access, when the Edge Function exchanges the auth code for tokens. The **Client ID** is usually fine; **`GOOGLE_CLIENT_SECRET` in Supabase is wrong, expired, or does not match that Client ID**.

### Fix

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **OAuth 2.0 Client ID** (Web application) used for TaskZM.
2. Confirm **Authorized redirect URIs** includes the callback URL above.
3. Under **Client secrets**, create a **new secret** (or copy the current one).
4. Update Supabase Edge Function secrets (Dashboard → Edge Functions → Secrets, or locally):

```bash
cp supabase/google-oauth.env.example supabase/google-oauth.env
# Edit supabase/google-oauth.env — paste Client ID + new Client secret
npm run setup:google-calendar
```

5. Try connecting Google Calendar again (no redeploy needed for secret-only changes).

Secrets must come from the **same** Web OAuth client. Do not mix Client ID from one client with a secret from another.

## Verify

- The **only** redirect URI you use for this app should be the one above (with `taskzm-database-function`).
- After changing both places, try connecting Google Calendar again; the callback should load the function and return the “Calendar connected successfully!” page instead of NOT_FOUND.

## "Google hasn't verified this app"

The warning screen is separate from NOT_FOUND. You can still complete the flow by using **Advanced** → **Go to taskZM (unsafe)**. For a better experience and to remove the warning, submit your app for [Google app verification](https://support.google.com/cloud/answer/9110914).
