import type { CapacitorConfig } from '@capacitor/cli';
import {
  MOBILE_APP_ID,
  MOBILE_DEEP_LINK_SCHEME,
  MOBILE_NOTIFICATION_SMALL_ICON,
  MOBILE_NOTIFICATION_ICON_COLOR,
  MOBILE_PRODUCTION_WEB_URL,
  MOBILE_USE_CLOUD_WEB_APP,
} from './lib/mobile-constants';

const useBundledWeb =
  process.env.CAPACITOR_USE_BUNDLED_WEB === '1' ||
  process.env.CAPACITOR_USE_BUNDLED_WEB === 'true';

const loadUiFromCloud = MOBILE_USE_CLOUD_WEB_APP && !useBundledWeb;

const config: CapacitorConfig = {
  appId: MOBILE_APP_ID,
  appName: 'TaskZM',
  webDir: 'dist',
  server: {
    ...(loadUiFromCloud
      ? {
          url: MOBILE_PRODUCTION_WEB_URL,
          cleartext: false,
        }
      : {}),
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: '#ffffff',
    },
    Keyboard: {
      resize: 'body',
    },
    LocalNotifications: {
      smallIcon: MOBILE_NOTIFICATION_SMALL_ICON,
      iconColor: MOBILE_NOTIFICATION_ICON_COLOR,
      sound: 'default',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    scheme: MOBILE_DEEP_LINK_SCHEME,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
