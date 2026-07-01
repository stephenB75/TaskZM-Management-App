import type { CapacitorConfig } from '@capacitor/cli';
import {
  MOBILE_APP_ID,
  MOBILE_DEEP_LINK_SCHEME,
  MOBILE_NOTIFICATION_SMALL_ICON,
  MOBILE_NOTIFICATION_ICON_COLOR,
} from './lib/mobile-constants';

const config: CapacitorConfig = {
  appId: MOBILE_APP_ID,
  appName: 'TaskZM',
  webDir: 'dist',
  server: {
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
  },
  ios: {
    scheme: MOBILE_DEEP_LINK_SCHEME,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
