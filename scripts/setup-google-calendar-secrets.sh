#!/bin/bash
# Push Google Calendar OAuth secrets to Supabase Edge Functions.
# Requires: supabase/google-oauth.env (copy from supabase/google-oauth.env.example)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/supabase/google-oauth.env"
PROJECT_REF="gflesnyfpxqhaunfskrw"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing $ENV_FILE"
  echo ""
  echo "1. Copy supabase/google-oauth.env.example → supabase/google-oauth.env"
  echo "2. Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Google Cloud Console"
  echo "   (Credentials → OAuth 2.0 Client ID → Web application → Client ID + Client secret)"
  echo "3. Re-run: npm run setup:google-calendar"
  exit 1
fi

# Validate required keys without printing secret values
missing=()
for key in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REDIRECT_URI; do
  if ! grep -q "^${key}=." "$ENV_FILE"; then
    missing+=("$key")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "❌ supabase/google-oauth.env is missing or has empty values for:"
  printf '   - %s\n' "${missing[@]}"
  exit 1
fi

if grep -q 'your-client-id' "$ENV_FILE" || grep -q 'GOCSPX-your-client-secret' "$ENV_FILE"; then
  echo "❌ Replace placeholder values in supabase/google-oauth.env with real Google OAuth credentials."
  exit 1
fi

echo "🔐 Setting Google Calendar OAuth secrets on project $PROJECT_REF..."
npx supabase secrets set --env-file "$ENV_FILE" --project-ref "$PROJECT_REF"

echo ""
echo "✅ Secrets updated (available immediately — no redeploy required for secret changes)."
echo "   Optional: redeploy edge function after code updates:"
echo "   npm run deploy:functions"
echo ""
echo "   Then try connecting Google Calendar again in Settings."
