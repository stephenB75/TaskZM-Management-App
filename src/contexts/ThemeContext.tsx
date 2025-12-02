import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { getFromLocalStorage, saveToLocalStorage } from '../lib/utils';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      if (typeof window !== 'undefined') {
        return getFromLocalStorage<Theme>('theme', 'system');
      }
      return 'system';
    } catch (error) {
      // Fallback to system theme if localStorage access fails
      return 'system';
    }
  });
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Safety check for SSR and HMR
    if (typeof window === 'undefined' || !window.document) {
      return;
    }

    const root = window.document.documentElement;
    if (!root) {
      console.warn('documentElement is null, skipping theme update');
      return;
    }
    
    const updateTheme = () => {
      try {
        let effectiveTheme: 'light' | 'dark' = 'light';
        
        if (theme === 'system') {
          if (window.matchMedia) {
            effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }
        } else {
          effectiveTheme = theme;
        }
        
        if (root && root.classList) {
          root.classList.remove('light', 'dark');
          root.classList.add(effectiveTheme);
          setActualTheme(effectiveTheme);
        }
      } catch (error) {
        console.error('Error updating theme:', error);
      }
    };

    updateTheme();

    // Listen for system theme changes
    if (theme === 'system' && window.matchMedia) {
      try {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (mediaQuery && mediaQuery.addEventListener) {
          const handler = () => updateTheme();
          mediaQuery.addEventListener('change', handler);
          return () => {
            if (mediaQuery && mediaQuery.removeEventListener) {
              mediaQuery.removeEventListener('change', handler);
            }
          };
        }
      } catch (error) {
        console.error('Error setting up theme listener:', error);
      }
    }
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    try {
      setThemeState(newTheme);
      if (typeof window !== 'undefined') {
        saveToLocalStorage('theme', newTheme);
      }
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  }, []);

  // Ensure we always provide a valid context value
  const contextValue = useMemo(() => ({
    theme,
    setTheme,
    actualTheme,
  }), [theme, setTheme, actualTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined || context === null) {
    // During React Fast Refresh (HMR), providers can temporarily unmount
    // Return a safe default instead of throwing to prevent crashes
    if (import.meta.env.DEV) {
      console.warn('useTheme called outside ThemeProvider (likely HMR issue), returning default');
      return {
        theme: 'system' as Theme,
        setTheme: () => {},
        actualTheme: 'light' as const,
      };
    }
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
