/**
 * Utility to detect user's country from browser locale/timezone
 * This is used to provide helpful hints for payment forms
 */

/**
 * Detect country code from browser locale
 * Returns ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'CA')
 */
export function detectCountryFromLocale(): string | null {
  if (typeof window === 'undefined' || !navigator) {
    return null;
  }

  try {
    // Try to get country from locale
    const locale = navigator.language || (navigator as any).userLanguage;
    if (locale) {
      // Locale format: 'en-US', 'en-GB', etc.
      const parts = locale.split('-');
      if (parts.length >= 2) {
        const countryCode = parts[parts.length - 1].toUpperCase();
        // Validate it's a 2-letter code
        if (countryCode.length === 2 && /^[A-Z]{2}$/.test(countryCode)) {
          return countryCode;
        }
      }
    }

    // Try to get from languages array
    if (navigator.languages && navigator.languages.length > 0) {
      for (const lang of navigator.languages) {
        const parts = lang.split('-');
        if (parts.length >= 2) {
          const countryCode = parts[parts.length - 1].toUpperCase();
          if (countryCode.length === 2 && /^[A-Z]{2}$/.test(countryCode)) {
            return countryCode;
          }
        }
      }
    }
  } catch (error) {
    console.debug('Country detection from locale failed:', error);
  }

  return null;
}

/**
 * Get country name from country code
 */
export function getCountryName(countryCode: string): string {
  const countryNames: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    CA: 'Canada',
    AU: 'Australia',
    DE: 'Germany',
    FR: 'France',
    IT: 'Italy',
    ES: 'Spain',
    NL: 'Netherlands',
    BE: 'Belgium',
    CH: 'Switzerland',
    AT: 'Austria',
    SE: 'Sweden',
    NO: 'Norway',
    DK: 'Denmark',
    FI: 'Finland',
    PL: 'Poland',
    IE: 'Ireland',
    PT: 'Portugal',
    GR: 'Greece',
    JP: 'Japan',
    CN: 'China',
    IN: 'India',
    BR: 'Brazil',
    MX: 'Mexico',
    AR: 'Argentina',
    ZA: 'South Africa',
    NZ: 'New Zealand',
    SG: 'Singapore',
    HK: 'Hong Kong',
    KR: 'South Korea',
    TW: 'Taiwan',
  };

  return countryNames[countryCode] || countryCode;
}

