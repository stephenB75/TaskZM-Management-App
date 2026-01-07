/**
 * PWA Browser Compatibility Verification
 * Checks if PWA features are supported and working across different browsers
 */

export interface PWACapabilities {
  serviceWorker: boolean;
  manifest: boolean;
  installPrompt: boolean;
  offlineSupport: boolean;
  pushNotifications: boolean;
  backgroundSync: boolean;
  browser: string;
  version: string;
  isMobile: boolean;
  isStandalone: boolean;
}

/**
 * Detect browser and version
 */
export function detectBrowser(): { name: string; version: string } {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = 'Unknown';

  // Chrome/Edge (Chromium-based)
  if (ua.includes('Edg/')) {
    name = 'Edge';
    version = ua.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    name = 'Chrome';
    version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
  }
  // Firefox
  else if (ua.includes('Firefox/')) {
    name = 'Firefox';
    version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
  }
  // Safari
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    name = 'Safari';
    const match = ua.match(/Version\/(\d+)/);
    version = match?.[1] || 'Unknown';
  }
  // Opera
  else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    name = 'Opera';
    version = ua.match(/(?:OPR|Opera)\/(\d+)/)?.[1] || 'Unknown';
  }

  return { name, version };
}

/**
 * Check if running in standalone mode (installed PWA)
 */
export function isStandalone(): boolean {
  // iOS Safari
  if ((window.navigator as any).standalone === true) {
    return true;
  }
  // Android Chrome/Edge
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // Windows/Mac (installed as PWA)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  return false;
}

/**
 * Check if device is mobile
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Verify PWA capabilities for current browser
 */
export async function verifyPWACapabilities(): Promise<PWACapabilities> {
  const browser = detectBrowser();
  const isMobile = isMobileDevice();
  const isStandaloneMode = isStandalone();

  const capabilities: PWACapabilities = {
    serviceWorker: 'serviceWorker' in navigator,
    manifest: 'manifest' in document.createElement('link'),
    installPrompt: false, // Will be set by beforeinstallprompt event
    offlineSupport: 'serviceWorker' in navigator,
    pushNotifications: 'PushManager' in window && 'Notification' in window,
    backgroundSync: 'sync' in (self as any).registration || false,
    browser: browser.name,
    version: browser.version,
    isMobile,
    isStandalone: isStandaloneMode,
  };

  // Check for install prompt support (Chrome/Edge)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      capabilities.backgroundSync = 'sync' in registration;
    } catch (e) {
      // Service worker not ready
    }
  }

  return capabilities;
}

/**
 * Check if service worker is registered and active
 */
export async function checkServiceWorkerStatus(): Promise<{
  registered: boolean;
  active: boolean;
  scope: string | null;
  error: string | null;
}> {
  if (!('serviceWorker' in navigator)) {
    return {
      registered: false,
      active: false,
      scope: null,
      error: 'Service Workers not supported',
    };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return {
        registered: false,
        active: false,
        scope: null,
        error: 'No service worker registration found',
      };
    }

    return {
      registered: true,
      active: registration.active !== null,
      scope: registration.scope,
      error: null,
    };
  } catch (error) {
    return {
      registered: false,
      active: false,
      scope: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if manifest is loaded
 */
export async function checkManifestStatus(): Promise<{
  loaded: boolean;
  manifest: any | null;
  error: string | null;
}> {
  try {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      return {
        loaded: false,
        manifest: null,
        error: 'Manifest link not found in HTML',
      };
    }

    const manifestUrl = (manifestLink as HTMLLinkElement).href;
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      return {
        loaded: false,
        manifest: null,
        error: `Failed to fetch manifest: ${response.statusText}`,
      };
    }

    const manifest = await response.json();
    return {
      loaded: true,
      manifest,
      error: null,
    };
  } catch (error) {
    return {
      loaded: false,
      manifest: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Browser-specific PWA support matrix
 */
export const BROWSER_PWA_SUPPORT = {
  Chrome: {
    minVersion: 67,
    serviceWorker: true,
    manifest: true,
    installPrompt: true,
    offlineSupport: true,
    pushNotifications: true,
    backgroundSync: true,
  },
  Edge: {
    minVersion: 79,
    serviceWorker: true,
    manifest: true,
    installPrompt: true,
    offlineSupport: true,
    pushNotifications: true,
    backgroundSync: true,
  },
  Firefox: {
    minVersion: 44,
    serviceWorker: true,
    manifest: true,
    installPrompt: false, // Firefox doesn't support beforeinstallprompt
    offlineSupport: true,
    pushNotifications: true,
    backgroundSync: false, // Limited support
  },
  Safari: {
    minVersion: 11.1,
    serviceWorker: true,
    manifest: true,
    installPrompt: false, // Safari uses Add to Home Screen
    offlineSupport: true,
    pushNotifications: false, // iOS Safari doesn't support push
    backgroundSync: false,
  },
  Opera: {
    minVersion: 54,
    serviceWorker: true,
    manifest: true,
    installPrompt: true,
    offlineSupport: true,
    pushNotifications: true,
    backgroundSync: true,
  },
} as const;

/**
 * Get browser-specific PWA support info
 */
export function getBrowserPWASupport(browserName: string): typeof BROWSER_PWA_SUPPORT.Chrome | null {
  const normalizedName = browserName.toLowerCase();
  
  if (normalizedName.includes('chrome') && !normalizedName.includes('edge')) {
    return BROWSER_PWA_SUPPORT.Chrome;
  } else if (normalizedName.includes('edge')) {
    return BROWSER_PWA_SUPPORT.Edge;
  } else if (normalizedName.includes('firefox')) {
    return BROWSER_PWA_SUPPORT.Firefox;
  } else if (normalizedName.includes('safari')) {
    return BROWSER_PWA_SUPPORT.Safari;
  } else if (normalizedName.includes('opera')) {
    return BROWSER_PWA_SUPPORT.Opera;
  }
  
  return null;
}

/**
 * Comprehensive PWA verification
 */
export async function verifyPWA(): Promise<{
  capabilities: PWACapabilities;
  serviceWorker: Awaited<ReturnType<typeof checkServiceWorkerStatus>>;
  manifest: Awaited<ReturnType<typeof checkManifestStatus>>;
  browserSupport: ReturnType<typeof getBrowserPWASupport> | null;
  issues: string[];
  warnings: string[];
}> {
  const capabilities = await verifyPWACapabilities();
  const serviceWorker = await checkServiceWorkerStatus();
  const manifest = await checkManifestStatus();
  const browserSupport = getBrowserPWASupport(capabilities.browser);
  
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check for critical issues
  if (!capabilities.serviceWorker) {
    issues.push('Service Workers are not supported in this browser');
  } else if (!serviceWorker.registered) {
    issues.push('Service Worker is not registered');
  }

  if (!manifest.loaded) {
    issues.push(`Manifest not loaded: ${manifest.error}`);
  }

  // Check browser version compatibility
  if (browserSupport) {
    const versionNum = parseInt(capabilities.version);
    if (!isNaN(versionNum) && versionNum < browserSupport.minVersion) {
      warnings.push(
        `Browser version ${capabilities.version} may not fully support PWA features. Minimum recommended: ${browserSupport.minVersion}`
      );
    }
  }

  // Safari-specific warnings
  if (capabilities.browser === 'Safari' && capabilities.isMobile) {
    if (!capabilities.pushNotifications) {
      warnings.push('Push notifications are not supported on iOS Safari');
    }
    if (!isStandalone()) {
      warnings.push('For best experience on iOS, add to Home Screen');
    }
  }

  // Firefox-specific warnings
  if (capabilities.browser === 'Firefox') {
    if (!capabilities.installPrompt) {
      warnings.push('Firefox uses manual installation (menu > Install)');
    }
    if (!capabilities.backgroundSync) {
      warnings.push('Background sync has limited support in Firefox');
    }
  }

  return {
    capabilities,
    serviceWorker,
    manifest,
    browserSupport,
    issues,
    warnings,
  };
}

/**
 * Log PWA verification results to console (for debugging)
 */
export async function logPWAStatus(): Promise<void> {
  const verification = await verifyPWA();
  
  console.group('🔍 PWA Verification Status');
  console.log('Browser:', verification.capabilities.browser, verification.capabilities.version);
  console.log('Mobile:', verification.capabilities.isMobile);
  console.log('Standalone:', verification.capabilities.isStandalone);
  console.log('');
  
  console.group('Capabilities');
  console.log('Service Worker:', verification.capabilities.serviceWorker ? '✅' : '❌');
  console.log('Manifest:', verification.capabilities.manifest ? '✅' : '❌');
  console.log('Install Prompt:', verification.capabilities.installPrompt ? '✅' : '❌');
  console.log('Offline Support:', verification.capabilities.offlineSupport ? '✅' : '❌');
  console.log('Push Notifications:', verification.capabilities.pushNotifications ? '✅' : '❌');
  console.log('Background Sync:', verification.capabilities.backgroundSync ? '✅' : '❌');
  console.groupEnd();
  
  console.group('Service Worker');
  console.log('Registered:', verification.serviceWorker.registered ? '✅' : '❌');
  console.log('Active:', verification.serviceWorker.active ? '✅' : '❌');
  console.log('Scope:', verification.serviceWorker.scope || 'N/A');
  if (verification.serviceWorker.error) {
    console.error('Error:', verification.serviceWorker.error);
  }
  console.groupEnd();
  
  console.group('Manifest');
  console.log('Loaded:', verification.manifest.loaded ? '✅' : '❌');
  if (verification.manifest.manifest) {
    console.log('Name:', verification.manifest.manifest.name);
    console.log('Display:', verification.manifest.manifest.display);
  }
  if (verification.manifest.error) {
    console.error('Error:', verification.manifest.error);
  }
  console.groupEnd();
  
  if (verification.issues.length > 0) {
    console.group('⚠️ Issues');
    verification.issues.forEach(issue => console.error(issue));
    console.groupEnd();
  }
  
  if (verification.warnings.length > 0) {
    console.group('ℹ️ Warnings');
    verification.warnings.forEach(warning => console.warn(warning));
    console.groupEnd();
  }
  
  console.groupEnd();
}

