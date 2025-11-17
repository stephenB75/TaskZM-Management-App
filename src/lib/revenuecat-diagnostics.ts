/**
 * RevenueCat Connection Diagnostics
 * Systematic diagnostic tool to trace RevenueCat connection issues
 */

import { getPlatform } from './platform';

export interface DiagnosticResult {
  step: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  data?: any;
  timestamp: string;
}

export interface FullDiagnosticReport {
  overallStatus: 'connected' | 'partial' | 'failed';
  results: DiagnosticResult[];
  summary: {
    apiKeyFound: boolean;
    apiKeyValid: boolean;
    sdkConfigured: boolean;
    sdkInitialized: boolean;
    offeringsAvailable: boolean;
    packagesFound: boolean;
    productDataAvailable: boolean;
  };
  recommendations: string[];
}

/**
 * Run comprehensive RevenueCat diagnostics
 */
export async function runRevenueCatDiagnostics(): Promise<FullDiagnosticReport> {
  const results: DiagnosticResult[] = [];
  const recommendations: string[] = [];
  
  const addResult = (step: string, status: DiagnosticResult['status'], message: string, data?: any) => {
    results.push({
      step,
      status,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  };

  console.log('🔍 Starting RevenueCat Diagnostics...');
  console.log('='.repeat(60));

  // Step 1: Check Environment Variables
  addResult('env_check', 'info', 'Checking environment variables...');
  const env = (import.meta as any).env || {};
  const apiKey = env.VITE_REVENUECAT_WEB_PUBLIC_KEY;
  
  if (!apiKey) {
    addResult('env_check', 'error', 'VITE_REVENUECAT_WEB_PUBLIC_KEY not found in environment variables', {
      availableEnvKeys: Object.keys(env).filter(k => k.includes('REVENUE') || k.includes('VITE'))
    });
    recommendations.push('Add VITE_REVENUECAT_WEB_PUBLIC_KEY to your .env file');
    recommendations.push('Get your API key from: RevenueCat Dashboard → Project Settings → API Keys');
  } else {
    const keyPrefix = apiKey.substring(0, Math.min(10, apiKey.length));
    const keySuffix = apiKey.length > 10 ? apiKey.substring(apiKey.length - 4) : '****';
    const isValidFormat = apiKey.startsWith('rc_') || apiKey.startsWith('rcb_');
    
    addResult('env_check', isValidFormat ? 'success' : 'error', 
      `API key found: ${keyPrefix}...${keySuffix} (${apiKey.length} chars)`, {
        format: isValidFormat ? 'valid' : 'invalid',
        expectedFormat: 'Should start with "rc_" or "rcb_"',
        keyType: apiKey.startsWith('rcb_') ? 'PUBLIC (web)' : apiKey.startsWith('rc_') ? 'PUBLIC (legacy)' : 'UNKNOWN'
      });
    
    if (!isValidFormat) {
      recommendations.push('API key format is invalid. For web apps, use a PUBLIC API key (starts with "rcb_")');
    }
  }

  // Step 2: Check Platform
  addResult('platform_check', 'info', 'Checking platform...');
  const platform = getPlatform();
  addResult('platform_check', 'success', `Platform detected: ${platform.platform}`, {
    isWeb: platform.isWeb,
    isIOS: platform.isIOS,
    isAndroid: platform.isAndroid
  });

  // Step 3: Check SDK Import
  addResult('sdk_import', 'info', 'Checking RevenueCat SDK import...');
  try {
    const PurchasesModule = await import('@revenuecat/purchases-js');
    const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
    
    if (!Purchases) {
      addResult('sdk_import', 'error', 'RevenueCat SDK module imported but Purchases class not found', {
        moduleKeys: Object.keys(PurchasesModule),
        hasDefault: !!PurchasesModule.default,
        hasPurchases: !!PurchasesModule.Purchases
      });
      recommendations.push('RevenueCat SDK may not be installed correctly. Run: npm install @revenuecat/purchases-js');
    } else {
      addResult('sdk_import', 'success', 'RevenueCat SDK imported successfully', {
        hasConfigure: typeof Purchases.configure === 'function',
        hasGetSharedInstance: typeof Purchases.getSharedInstance === 'function',
        hasGetOfferings: typeof Purchases.getOfferings === 'function'
      });
    }
  } catch (importError: any) {
    addResult('sdk_import', 'error', 'Failed to import RevenueCat SDK', {
      error: importError.message || importError,
      stack: importError.stack
    });
    recommendations.push('Install RevenueCat SDK: npm install @revenuecat/purchases-js');
  }

  // Step 4: Check Configuration Status
  addResult('config_check', 'info', 'Checking RevenueCat configuration status...');
  try {
    const { isRevenueCatConfigured, getCurrentUserId } = await import('./revenuecat');
    const isConfigured = isRevenueCatConfigured();
    const userId = getCurrentUserId();
    
    addResult('config_check', isConfigured ? 'success' : 'warning', 
      `Configuration status: ${isConfigured ? 'CONFIGURED' : 'NOT CONFIGURED'}`, {
        isConfigured,
        userId: userId || 'N/A',
        needsConfiguration: !isConfigured
      });
    
    if (!isConfigured) {
      recommendations.push('RevenueCat is not configured. Ensure configureRevenueCat() is called on user login');
    }
    
    if (isConfigured && !userId) {
      recommendations.push('RevenueCat is configured but no user ID found. This may cause issues with offerings');
    }
  } catch (error: any) {
    addResult('config_check', 'error', 'Failed to check configuration status', {
      error: error.message || error
    });
  }

  // Step 5: Check SDK Instance
  addResult('sdk_instance', 'info', 'Checking RevenueCat SDK instance...');
  try {
    const PurchasesModule = await import('@revenuecat/purchases-js');
    const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
    
    if (Purchases && typeof Purchases.getSharedInstance === 'function') {
      try {
        const instance = Purchases.getSharedInstance();
        
        if (!instance) {
          addResult('sdk_instance', 'error', 'getSharedInstance() returned null/undefined', {
            instanceType: typeof instance
          });
          recommendations.push('RevenueCat SDK instance is null. Ensure configureRevenueCat() is called before using SDK');
        } else {
          addResult('sdk_instance', 'success', 'SDK instance retrieved successfully', {
            hasGetOfferings: typeof instance.getOfferings === 'function',
            hasSyncPurchases: typeof instance.syncPurchases === 'function',
            hasGetCustomerInfo: typeof instance.getCustomerInfo === 'function'
          });
        }
      } catch (instanceError: any) {
        addResult('sdk_instance', 'error', 'Failed to get SDK instance', {
          error: instanceError.message || instanceError,
          code: instanceError.code,
          name: instanceError.name
        });
        recommendations.push('SDK instance error. This usually means RevenueCat is not configured. Call configureRevenueCat() first');
      }
    } else {
      addResult('sdk_instance', 'error', 'getSharedInstance method not available', {
        hasPurchases: !!Purchases,
        hasGetSharedInstance: Purchases && typeof Purchases.getSharedInstance === 'function'
      });
    }
  } catch (error: any) {
    addResult('sdk_instance', 'error', 'Failed to check SDK instance', {
      error: error.message || error
    });
  }

  // Step 6: Test getOfferings Call
  addResult('offerings_call', 'info', 'Testing getOfferings() call...');
  try {
    const { getOfferings, isRevenueCatConfigured } = await import('./revenuecat');
    
    if (!isRevenueCatConfigured()) {
      addResult('offerings_call', 'warning', 'Skipping offerings test - RevenueCat not configured');
    } else {
      try {
        const offerings = await getOfferings(true);
        
        if (!offerings) {
          addResult('offerings_call', 'error', 'getOfferings() returned null', {
            possibleReasons: [
              'No current offering set in RevenueCat dashboard',
              'No packages attached to offering',
              'API key is invalid or expired',
              'Network connectivity issues'
            ]
          });
          recommendations.push('Check RevenueCat dashboard: Ensure a "current" offering is set');
          recommendations.push('Check RevenueCat dashboard: Ensure packages are attached to the offering');
        } else {
          const packageCount = offerings.availablePackages?.length || 0;
          addResult('offerings_call', 'success', `getOfferings() returned ${packageCount} package(s)`, {
            offeringId: offerings.identifier,
            packageCount,
            packageIdentifiers: offerings.availablePackages?.map((p: any) => p?.identifier || 'unknown') || []
          });
          
          if (packageCount === 0) {
            recommendations.push('No packages found in offering. Add packages to your offering in RevenueCat dashboard');
          }
        }
      } catch (offeringsError: any) {
        addResult('offerings_call', 'error', 'getOfferings() threw an error', {
          error: offeringsError.message || offeringsError,
          code: offeringsError.code,
          name: offeringsError.name,
          stack: offeringsError.stack
        });
        
        // Check for specific error types
        if (offeringsError.message?.includes('401') || offeringsError.message?.includes('Unauthorized')) {
          recommendations.push('API key is invalid or expired. Update VITE_REVENUECAT_WEB_PUBLIC_KEY');
        }
        if (offeringsError.message?.includes('network') || offeringsError.message?.includes('fetch')) {
          recommendations.push('Network error. Check internet connection and RevenueCat service status');
        }
      }
    }
  } catch (error: any) {
    addResult('offerings_call', 'error', 'Failed to test getOfferings()', {
      error: error.message || error
    });
  }

  // Step 7: Check Package Product Data
  addResult('product_data', 'info', 'Checking package product data...');
  try {
    const { getOfferings, isRevenueCatConfigured } = await import('./revenuecat');
    
    if (!isRevenueCatConfigured()) {
      addResult('product_data', 'warning', 'Skipping product data check - RevenueCat not configured');
    } else {
      const offerings = await getOfferings(true);
      
      if (offerings && offerings.availablePackages) {
        const packagesWithProductData = offerings.availablePackages.filter((p: any) => 
          p?.product && 
          typeof p.product === 'object' && 
          Object.keys(p.product).length > 0
        );
        
        const packagesWithoutProductData = offerings.availablePackages.filter((p: any) => 
          !p?.product || 
          typeof p.product !== 'object' || 
          Object.keys(p.product).length === 0
        );
        
        addResult('product_data', 
          packagesWithoutProductData.length === 0 ? 'success' : 'warning',
          `Product data status: ${packagesWithProductData.length} with data, ${packagesWithoutProductData.length} without`, {
            totalPackages: offerings.availablePackages.length,
            withProductData: packagesWithProductData.length,
            withoutProductData: packagesWithoutProductData.length,
            packagesWithoutData: packagesWithoutProductData.map((p: any) => ({
              identifier: p?.identifier || 'unknown',
              hasProduct: !!p?.product,
              productType: typeof p?.product,
              productKeys: p?.product && typeof p.product === 'object' ? Object.keys(p.product) : []
            }))
          });
        
        if (packagesWithoutProductData.length > 0) {
          recommendations.push('Some packages are missing product data. Link products to packages in RevenueCat dashboard');
          recommendations.push('Ensure products are created in Stripe and linked to packages in RevenueCat');
        }
      } else {
        addResult('product_data', 'warning', 'No offerings available to check product data');
      }
    }
  } catch (error: any) {
    addResult('product_data', 'error', 'Failed to check product data', {
      error: error.message || error
    });
  }

  // Step 8: Direct SDK Call Test
  addResult('direct_sdk_test', 'info', 'Testing direct SDK call...');
  try {
    const PurchasesModule = await import('@revenuecat/purchases-js');
    const Purchases = (PurchasesModule.default?.Purchases || PurchasesModule.Purchases || PurchasesModule.default || PurchasesModule) as any;
    
    if (Purchases && typeof Purchases.getSharedInstance === 'function') {
      const instance = Purchases.getSharedInstance();
      
      if (instance) {
        try {
          const directOfferings = await instance.getOfferings();
          
          addResult('direct_sdk_test', 'success', 'Direct SDK call successful', {
            hasCurrent: !!directOfferings?.current,
            hasAll: !!directOfferings?.all,
            currentOfferingId: directOfferings?.current?.identifier || 'N/A',
            currentPackageCount: directOfferings?.current?.availablePackages?.length || 0,
            allOfferingsCount: directOfferings?.all ? Object.keys(directOfferings.all).length : 0
          });
          
          if (!directOfferings?.current) {
            recommendations.push('No current offering in RevenueCat. Set a "current" offering in RevenueCat dashboard');
          }
        } catch (directError: any) {
          addResult('direct_sdk_test', 'error', 'Direct SDK call failed', {
            error: directError.message || directError,
            code: directError.code,
            name: directError.name
          });
        }
      } else {
        addResult('direct_sdk_test', 'error', 'Cannot test - SDK instance is null');
      }
    } else {
      addResult('direct_sdk_test', 'error', 'Cannot test - getSharedInstance not available');
    }
  } catch (error: any) {
    addResult('direct_sdk_test', 'error', 'Failed to test direct SDK call', {
      error: error.message || error
    });
  }

  // Generate Summary
  const summary = {
    apiKeyFound: !!apiKey,
    apiKeyValid: apiKey ? (apiKey.startsWith('rc_') || apiKey.startsWith('rcb_')) : false,
    sdkConfigured: results.find(r => r.step === 'config_check')?.status === 'success' && 
                   results.find(r => r.step === 'config_check')?.data?.isConfigured === true,
    sdkInitialized: results.find(r => r.step === 'sdk_instance')?.status === 'success',
    offeringsAvailable: results.find(r => r.step === 'offerings_call')?.status === 'success' &&
                        results.find(r => r.step === 'offerings_call')?.data?.packageCount > 0,
    packagesFound: results.find(r => r.step === 'offerings_call')?.data?.packageCount > 0,
    productDataAvailable: results.find(r => r.step === 'product_data')?.status === 'success' &&
                          results.find(r => r.step === 'product_data')?.data?.withoutProductData === 0
  };

  // Determine overall status
  const errorCount = results.filter(r => r.status === 'error').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  
  let overallStatus: 'connected' | 'partial' | 'failed';
  if (errorCount === 0 && warningCount === 0 && summary.offeringsAvailable && summary.productDataAvailable) {
    overallStatus = 'connected';
  } else if (summary.sdkConfigured && summary.offeringsAvailable) {
    overallStatus = 'partial';
  } else {
    overallStatus = 'failed';
  }

  const report: FullDiagnosticReport = {
    overallStatus,
    results,
    summary,
    recommendations: [...new Set(recommendations)] // Remove duplicates
  };

  // Log summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  console.log(`Overall Status: ${overallStatus.toUpperCase()}`);
  console.log(`API Key: ${summary.apiKeyFound ? '✅ Found' : '❌ Missing'} ${summary.apiKeyValid ? '(Valid)' : '(Invalid)'}`);
  console.log(`SDK Configured: ${summary.sdkConfigured ? '✅ Yes' : '❌ No'}`);
  console.log(`SDK Initialized: ${summary.sdkInitialized ? '✅ Yes' : '❌ No'}`);
  console.log(`Offerings Available: ${summary.offeringsAvailable ? '✅ Yes' : '❌ No'}`);
  console.log(`Packages Found: ${summary.packagesFound ? '✅ Yes' : '❌ No'}`);
  console.log(`Product Data Available: ${summary.productDataAvailable ? '✅ Yes' : '❌ No'}`);
  console.log(`\nErrors: ${errorCount}, Warnings: ${warningCount}`);
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
  }
  
  console.log('='.repeat(60));

  return report;
}

/**
 * Log diagnostic report to console in a readable format
 */
export function logDiagnosticReport(report: FullDiagnosticReport): void {
  console.log('\n🔍 REVENUECAT DIAGNOSTIC REPORT');
  console.log('='.repeat(60));
  
  report.results.forEach((result, index) => {
    const icon = result.status === 'success' ? '✅' : 
                 result.status === 'error' ? '❌' : 
                 result.status === 'warning' ? '⚠️' : 'ℹ️';
    
    console.log(`\n${index + 1}. ${icon} ${result.step.toUpperCase()}`);
    console.log(`   ${result.message}`);
    if (result.data) {
      console.log(`   Data:`, result.data);
    }
  });
  
  console.log('\n' + '='.repeat(60));
}

