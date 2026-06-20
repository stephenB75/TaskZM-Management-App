/** Canonical path for Google OAuth callback (no leading slash for URL constructor). */
export const GOOGLE_CALLBACK_PATH =
  'functions/v1/taskzm-database-function/calendar/google/callback';

/** Strip whitespace and surrounding quotes from copied OAuth env values. */
export function sanitizeOAuthEnvValue(value: string | undefined | null): string | null {
  if (!value) return null;
  let trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve redirect URI for Google Calendar OAuth. Uses GOOGLE_REDIRECT_URI if set and valid;
 * otherwise builds from SUPABASE_URL so it always matches the actual callback URL.
 */
export function getGoogleRedirectUri(): string | null {
  let uri = sanitizeOAuthEnvValue(Deno.env.get('GOOGLE_REDIRECT_URI'));
  if (uri) {
    uri = uri.split('?')[0].split('#')[0].replace(/\/+$/, '');
    try {
      const url = new URL(uri);
      if (url.protocol === 'https:') return uri;
    } catch {
      // fall through to built
    }
  }
  const base = sanitizeOAuthEnvValue(Deno.env.get('SUPABASE_URL'));
  if (!base) return null;
  const built = new URL('/' + GOOGLE_CALLBACK_PATH, base.replace(/\/+$/, '') + '/').href.replace(
    /\/+$/,
    '',
  );
  return built;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = sanitizeOAuthEnvValue(Deno.env.get('GOOGLE_CLIENT_ID'));
  const clientSecret = sanitizeOAuthEnvValue(Deno.env.get('GOOGLE_CLIENT_SECRET'));
  const redirectUri = getGoogleRedirectUri();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function getGoogleOAuthConfigDiagnostics() {
  const clientId = sanitizeOAuthEnvValue(Deno.env.get('GOOGLE_CLIENT_ID'));
  const clientSecret = sanitizeOAuthEnvValue(Deno.env.get('GOOGLE_CLIENT_SECRET'));
  const redirectUri = getGoogleRedirectUri();
  return {
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    hasRedirectUri: Boolean(redirectUri),
    redirectUri,
    clientIdSuffix: clientId?.endsWith('.apps.googleusercontent.com')
      ? clientId.slice(-30)
      : clientId
        ? '(unexpected format — use Web application client ID)'
        : null,
    clientSecretLooksValid: Boolean(clientSecret?.startsWith('GOCSPX-')),
  };
}

/** Map Google token endpoint errors to actionable user messages. */
export function mapGoogleTokenExchangeError(errorText: string): string {
  try {
    const errJson = JSON.parse(errorText);
    const code = errJson.error;
    const msg = errJson.error_description || errJson.error;
    if (code === 'redirect_uri_mismatch') {
      return 'Redirect URI mismatch: add this exact URL in Google Cloud Console → Credentials → Authorized redirect URIs (no trailing slash).';
    }
    if (code === 'invalid_client' || (typeof msg === 'string' && msg.toLowerCase().includes('client secret'))) {
      return 'Invalid Google client secret: regenerate the secret in Google Cloud Console and update GOOGLE_CLIENT_SECRET in Supabase Edge Function secrets (must match the same OAuth client as GOOGLE_CLIENT_ID).';
    }
    if (typeof msg === 'string' && msg.length > 0) return msg;
  } catch {
    // use default
  }
  return 'Failed to exchange authorization code';
}
