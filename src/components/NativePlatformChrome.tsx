/**
 * Syncs native iOS/Android chrome (status bar) with app theme.
 * Mount inside ThemeProvider.
 */

import { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { syncNativeStatusBarTheme } from '../lib/native-status-bar';

export function NativePlatformChrome() {
  const { actualTheme } = useTheme();

  useEffect(() => {
    void syncNativeStatusBarTheme(actualTheme === 'dark');
  }, [actualTheme]);

  return null;
}
