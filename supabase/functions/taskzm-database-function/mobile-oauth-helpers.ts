/**
 * Mobile OAuth helpers for calendar callback pages (native deep link redirect).
 */

const DEFAULT_DEEP_LINK_SCHEME = 'com.app.taskzm.com';

export function getMobileDeepLinkScheme(): string {
  return Deno.env.get('MOBILE_DEEP_LINK_SCHEME') || DEFAULT_DEEP_LINK_SCHEME;
}

export function buildOAuthState(userId: string, platform?: string | null): string {
  if (platform === 'native') {
    return encodeURIComponent(`${userId}|native`);
  }
  return encodeURIComponent(userId);
}

export function parseOAuthState(stateParam: string | undefined): {
  userId: string;
  isNative: boolean;
} {
  const decoded = stateParam ? decodeURIComponent(stateParam) : '';
  const pipeIndex = decoded.indexOf('|');
  if (pipeIndex === -1) {
    return { userId: decoded, isNative: false };
  }
  const userId = decoded.slice(0, pipeIndex);
  const flag = decoded.slice(pipeIndex + 1);
  return { userId, isNative: flag === 'native' };
}

export function buildCalendarOAuthDeepLink(
  provider: 'google' | 'outlook',
  status: 'success' | 'error',
  errorMessage?: string
): string {
  const scheme = getMobileDeepLinkScheme();
  const params = new URLSearchParams({
    provider,
    status,
  });
  if (errorMessage) {
    params.set('error', errorMessage);
  }
  return `${scheme}://calendar-oauth?${params.toString()}`;
}

export function calendarOAuthResultHtml(options: {
  provider: 'google' | 'outlook';
  success: boolean;
  error?: string;
  isNative: boolean;
  appUrl: string;
}): string {
  const { provider, success, error, isNative, appUrl } = options;
  const messageType = success ? 'calendar-oauth-success' : 'calendar-oauth-error';
  const safeError = (error ?? 'Unknown error').replace(/'/g, "\\'").replace(/</g, '&lt;');
  const deepLink = buildCalendarOAuthDeepLink(
    provider,
    success ? 'success' : 'error',
    success ? undefined : error
  );

  if (isNative) {
    return `<!DOCTYPE html>
<html>
<head>
  <title>${success ? 'Calendar Connected' : 'Calendar Connection Failed'}</title>
  <meta http-equiv="refresh" content="0;url=${deepLink}">
</head>
<body>
  <script>
    window.location.href = '${deepLink}';
  </script>
  <p>${success ? 'Calendar connected! Returning to TaskZM…' : `Connection failed: ${safeError}`}</p>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <title>${success ? 'Calendar Connected' : 'Calendar Connection Failed'}</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: '${messageType}',
        provider: '${provider}'${success ? '' : `, error: '${safeError}'`}
      }, '*');
      setTimeout(() => { window.close(); }, 200);
    } else {
      window.location.href = '${appUrl}';
    }
  </script>
  <p>${success ? 'Calendar connected successfully! This window will close automatically.' : `Connection failed: ${safeError}. This window will close automatically.`}</p>
</body>
</html>`;
}
