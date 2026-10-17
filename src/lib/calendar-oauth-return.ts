/**
 * Finishes Google/Outlook calendar OAuth. The edge function redirects back with `code` + signed
 * `state`; we exchange them as the signed-in user, which is what ties the calendar to this account.
 */

import { CALENDAR_API_BASE } from './calendar-api-base';
import {
  CALENDAR_OAUTH_BROADCAST_CHANNEL,
  CALENDAR_OAUTH_MESSAGE_TYPES,
  CALENDAR_OAUTH_RETURN_PATH,
  CALENDAR_PROVIDER_DISPLAY_NAMES,
  CALENDAR_PROVIDERS,
  type CalendarProviderId,
} from './calendar-integration-constants';
import { TIMING_CONSTANTS } from './timing-constants';

export interface CalendarOAuthResult {
  type: typeof CALENDAR_OAUTH_MESSAGE_TYPES.success | typeof CALENDAR_OAUTH_MESSAGE_TYPES.error;
  provider: CalendarProviderId;
  error?: string;
}

const DEFAULT_ERROR = 'Calendar connection failed';

function isOAuthProvider(value: string | null): value is CalendarProviderId {
  return value === CALENDAR_PROVIDERS.google || value === CALENDAR_PROVIDERS.outlook;
}

export async function exchangeCalendarOAuthCode(
  provider: CalendarProviderId,
  code: string,
  state: string,
): Promise<CalendarOAuthResult> {
  try {
    const { supabase } = await import('./supabase-client');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { type: CALENDAR_OAUTH_MESSAGE_TYPES.error, provider, error: 'Please sign in to TaskZM, then connect your calendar again.' };
    }
    const response = await fetch(`${CALENDAR_API_BASE}/calendar/${provider}/exchange`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      return { type: CALENDAR_OAUTH_MESSAGE_TYPES.error, provider, error: data?.error || DEFAULT_ERROR };
    }
    return { type: CALENDAR_OAUTH_MESSAGE_TYPES.success, provider };
  } catch (error) {
    return { type: CALENDAR_OAUTH_MESSAGE_TYPES.error, provider, error: error instanceof Error ? error.message : DEFAULT_ERROR };
  }
}

/** Reads `provider` / `code` / `state` / `error` from an OAuth return URL and resolves the outcome. */
export async function resolveCalendarOAuthReturn(params: URLSearchParams): Promise<CalendarOAuthResult | null> {
  const provider = params.get('provider');
  if (!isOAuthProvider(provider)) return null;
  const code = params.get('code');
  const state = params.get('state');
  if (code && state) return exchangeCalendarOAuthCode(provider, code, state);
  return { type: CALENDAR_OAUTH_MESSAGE_TYPES.error, provider, error: params.get('error') || DEFAULT_ERROR };
}

function renderMessage(text: string): void {
  const root = document.getElementById('root') ?? document.body;
  root.innerHTML = '';
  const message = document.createElement('p');
  message.textContent = text;
  message.style.cssText = 'font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 3rem 1.5rem; color: #525252;';
  root.appendChild(message);
  document.body.classList.add('loaded');
}

/**
 * Web only: when this window is the OAuth return page, finish the exchange, report the result to
 * the tab that started it, and close. Returns true when the page was handled (skip app render).
 */
export async function handleCalendarOAuthReturnPage(): Promise<boolean> {
  if (window.location.pathname !== CALENDAR_OAUTH_RETURN_PATH) return false;
  const params = new URLSearchParams(window.location.search);
  window.history.replaceState(null, '', CALENDAR_OAUTH_RETURN_PATH);

  renderMessage('Connecting your calendar…');
  const result = await resolveCalendarOAuthReturn(params);
  if (!result) {
    window.location.replace('/');
    return true;
  }

  try {
    const channel = new BroadcastChannel(CALENDAR_OAUTH_BROADCAST_CHANNEL);
    channel.postMessage(result);
    channel.close();
  } catch {
    // BroadcastChannel unavailable; fall back to opener below.
  }
  try {
    window.opener?.postMessage(result, window.location.origin);
  } catch {
    // Opener severed (COOP) or gone.
  }

  const name = CALENDAR_PROVIDER_DISPLAY_NAMES[result.provider];
  renderMessage(
    result.type === CALENDAR_OAUTH_MESSAGE_TYPES.success
      ? `${name} Calendar connected. You can close this window.`
      : `Couldn't connect ${name} Calendar: ${result.error ?? DEFAULT_ERROR}. You can close this window.`,
  );
  window.setTimeout(() => window.close(), TIMING_CONSTANTS.delays.calendarPopup);
  return true;
}
