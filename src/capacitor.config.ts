import type { CapacitorConfig } from '@capacitor/cli';
import { MOBILE_APP_ID, MOBILE_DEEP_LINK_SCHEME } from './lib/mobile-constants';

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
  },
  ios: {
    scheme: MOBILE_DEEP_LINK_SCHEME,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
