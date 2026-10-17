/**
 * Calendar OAuth (Google / Outlook) state and return helpers.
 *
 * The provider callback never stores tokens. It sends the authorization code back to the app
 * (web page or native deep link); the app, signed in as whoever is completing the flow, posts
 * it to /calendar/:provider/exchange. Tokens are stored only when that signed-in user matches
 * the user the signed `state` was issued to, so a consent link can't attach someone else's
 * calendar to another account.
 */

const DEFAULT_DEEP_LINK_SCHEME = 'com.app.taskzm.com';
const DEFAULT_APP_URL = 'https://app.taskzm.com';
/** Path in the web app that finishes the exchange (see src/lib/calendar-oauth-return.ts). */
const WEB_RETURN_PATH = '/calendar-oauth';
const STATE_TTL_MS = 15 * 60 * 1000;
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

export type OAuthCalendarProvider = 'google' | 'outlook';

export interface OAuthStatePayload {
  userId: string;
  isNative: boolean;
  /** Web app origin to return to (validated when the state is issued). */
  origin: string;
  exp: number;
  nonce: string;
}

export function getMobileDeepLinkScheme(): string {
  return Deno.env.get('MOBILE_DEEP_LINK_SCHEME') || DEFAULT_DEEP_LINK_SCHEME;
}

/** The web app (serves /calendar-oauth). APP_URL may point at the marketing site, so it is only allowlisted. */
function appUrl(): string {
  return (Deno.env.get('CALENDAR_OAUTH_WEB_APP_URL') || DEFAULT_APP_URL).replace(/\/+$/, '');
}

/** Only our own web app (or local dev) may receive authorization codes. */
export function resolveReturnOrigin(requestOrigin: string | null | undefined): string {
  const fallback = appUrl();
  if (!requestOrigin) return fallback;
  const allowed = new Set([fallback, DEFAULT_APP_URL, (Deno.env.get('APP_URL') || '').replace(/\/+$/, '')]);
  if (allowed.has(requestOrigin) || LOCAL_ORIGIN_PATTERN.test(requestOrigin)) return requestOrigin;
  return fallback;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signingKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('OAUTH_STATE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new Error('OAuth state signing secret is not configured');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function buildOAuthState(
  userId: string,
  platform: string | null | undefined,
  requestOrigin: string | null | undefined,
): Promise<string> {
  const payload: OAuthStatePayload = {
    userId,
    isNative: platform === 'native',
    origin: resolveReturnOrigin(requestOrigin),
    exp: Date.now() + STATE_TTL_MS,
    nonce: crypto.randomUUID(),
  };
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(), new TextEncoder().encode(body)));
  return `${body}.${base64UrlEncode(signature)}`;
}

/** Verified, unexpired state payload, or null when it was tampered with, expired, or malformed. */
export async function parseOAuthState(stateParam: string | null | undefined): Promise<OAuthStatePayload | null> {
  if (!stateParam) return null;
  const [body, signature] = stateParam.split('.');
  if (!body || !signature) return null;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(),
      base64UrlDecode(signature),
      new TextEncoder().encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as OAuthStatePayload;
    if (!payload?.userId || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Where the provider callback sends the user next: the native deep link or the web return page,
 * carrying either the code + state (to exchange) or an error.
 */
export function buildCalendarOAuthReturnUrl(
  provider: OAuthCalendarProvider,
  state: OAuthStatePayload | null,
  result: { code: string; rawState: string } | { error: string },
): string {
  const params = new URLSearchParams({ provider });
  if ('code' in result) {
    params.set('code', result.code);
    params.set('state', result.rawState);
  } else {
    params.set('status', 'error');
    params.set('error', result.error);
  }
  if (state?.isNative) return `${getMobileDeepLinkScheme()}://calendar-oauth?${params.toString()}`;
  return `${state?.origin ?? appUrl()}${WEB_RETURN_PATH}?${params.toString()}`;
}
