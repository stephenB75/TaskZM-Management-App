/**
 * RevenueCat Connection Verification
 * Comprehensive check to confirm frontend is properly connected to RevenueCat
 */

import { isRevenueCatConfigured, getCurrentUserId, getOfferings } from './revenuecat';
import { getPlatform } from './platform';

export interface RevenueCatConnectionStatus {
  isConnected: boolean;
  isConfigured: boolean;
  hasApiKey: boolean;
  userId: string | null;
  platform: string;
  offeringsAvailable: boolean;
  packageCount: number;
  errors: string[];
  warnings: string[];
  details: {
    apiKeyFound: boolean;
    apiKeyFormat: 'valid' | 'invalid' | 'missing';
    sdkLoaded: boolean;
    configurationComplete: boolean;
    offeringsLoaded: boolean;
  };
}

/**
 * Comprehensive RevenueCat connection verification
 */
export async function verifyRevenueCatConnection(): Promise<RevenueCatConnectionStatus> {
  const status: RevenueCatConnectionStatus = {
    isConnected: false,
    isConfigured: false,
    hasApiKey: false,
    userId: null,
    platform: 'unknown',
    offeringsAvailable: false,
    packageCount: 0,
    errors: [],
    warnings: [],
    details: {
      apiKeyFound: false,
      apiKeyFormat: 'missing',
      sdkLoaded: false,
      configurationComplete: false,
      offeringsLoaded: false,
    },
  };

  try {
    // 1. Check platform
    const platform = getPlatform();
    status.platform = platform.platform;

    // 2. Check API key
    if (platform.isWeb) {
      const env = (import.meta as any).env || {};
      const apiKey = env.VITE_REVENUECAT_WEB_PUBLIC_KEY;
      
      if (apiKey) {
        status.hasApiKey = true;
        status.details.apiKeyFound = true;
        
        if (apiKey.startsWith('rc_') || apiKey.startsWith('rcb_')) {
          status.details.apiKeyFormat = 'valid';
        } else {
          status.details.apiKeyFormat = 'invalid';
          status.warnings.push(`API key format may be invalid (expected 'rc_' or 'rcb_' prefix)`);
        }
      } else {
        status.details.apiKeyFormat = 'missing';
        status.errors.push('VITE_REVENUECAT_WEB_PUBLIC_KEY not found in environment variables');
      }
    } else {
      // Native platforms - API key is configured in native app
      status.hasApiKey = true;
      status.details.apiKeyFound = true;
      status.details.apiKeyFormat = 'valid';
    }

    // 3. Check SDK availability
    if (platform.isWeb) {
      try {
        const PurchasesModule = await import('@revenuecat/purchases-js');
        const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
        
        if (Purchases && typeof Purchases.configure === 'function') {
          status.details.sdkLoaded = true;
        } else {
          status.errors.push('RevenueCat SDK loaded but configure function not found');
        }
      } catch (error: any) {
        status.errors.push(`Failed to load RevenueCat SDK: ${error.message || error}`);
      }
    } else {
      // Native platforms
      const Capacitor = (window as any).Capacitor;
      const Purchases = Capacitor?.Plugins?.Purchases;
      if (Purchases) {
        status.details.sdkLoaded = true;
      } else {
        status.errors.push('RevenueCat native plugin not available');
      }
    }

    // 4. Check configuration status
    const configured = isRevenueCatConfigured();
    status.isConfigured = configured;
    status.details.configurationComplete = configured;

    if (!configured) {
      status.warnings.push('RevenueCat is not configured. Call configureRevenueCat(userId) to initialize.');
    }

    // 5. Get user ID
    const userId = getCurrentUserId();
    status.userId = userId;

    if (!userId) {
      status.warnings.push('No user ID set in RevenueCat configuration');
    }

    // 6. Try to load offerings (this is the real connection test)
    if (configured) {
      try {
        const offerings = await getOfferings();
        
        if (offerings && offerings.availablePackages && offerings.availablePackages.length > 0) {
          status.offeringsAvailable = true;
          status.packageCount = offerings.availablePackages.length;
          status.details.offeringsLoaded = true;
          status.isConnected = true;
        } else {
          status.warnings.push('RevenueCat is configured but no offerings are available. Check RevenueCat dashboard.');
        }
      } catch (error: any) {
        status.errors.push(`Failed to load offerings: ${error.message || error}`);
      }
    }

    // Final connection status
    if (status.isConfigured && status.offeringsAvailable && status.errors.length === 0) {
      status.isConnected = true;
    }

  } catch (error: any) {
    status.errors.push(`Verification failed: ${error.message || error}`);
  }

  return status;
}

/**
 * Log connection status to console in a readable format
 */
export function logRevenueCatConnectionStatus(status: RevenueCatConnectionStatus): void {
  console.log('\n🔍 RevenueCat Connection Verification');
  console.log('═'.repeat(50));
  console.log(`Platform: ${status.platform}`);
  console.log(`API Key: ${status.hasApiKey ? '✅ Found' : '❌ Missing'} (${status.details.apiKeyFormat})`);
  console.log(`SDK Loaded: ${status.details.sdkLoaded ? '✅' : '❌'}`);
  console.log(`Configured: ${status.isConfigured ? '✅' : '❌'}`);
  console.log(`User ID: ${status.userId || '❌ Not set'}`);
  console.log(`Offerings: ${status.offeringsAvailable ? `✅ ${status.packageCount} package(s)` : '❌ Not available'}`);
  console.log(`Connection Status: ${status.isConnected ? '✅ CONNECTED' : '❌ NOT CONNECTED'}`);
  
  if (status.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    status.warnings.forEach(warning => console.log(`   • ${warning}`));
  }
  
  if (status.errors.length > 0) {
    console.log('\n❌ Errors:');
    status.errors.forEach(error => console.log(`   • ${error}`));
  }
  
  console.log('═'.repeat(50) + '\n');
}

