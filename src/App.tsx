import React, { Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { NativePlatformChrome } from './components/NativePlatformChrome';
import { lazyWithRetry } from './lib/lazy-with-retry';
import { SPLASH_SCREEN_TEXT, REACT_LOADING_SCREEN, APP_TEXT_FALLBACK_COLOR, LOADING_SCREEN_GRADIENT_CLASS } from './lib/layout-constants';
import logoImageBlack from './assets/Taskzm_Logo_BLK-removebg.png';

const AuthenticatedApp = lazyWithRetry(() => import('./AuthenticatedApp').then(m => ({ default: m.default })));

/**
 * Full-screen loading fallback (logo + spinner) for Suspense while AuthenticatedApp chunk loads.
 */
function AppLoadingFallback() {
  return (
    <div
      className={`fixed inset-0 h-screen w-screen flex items-center justify-center ${LOADING_SCREEN_GRADIENT_CLASS}`}
      style={{ zIndex: REACT_LOADING_SCREEN.zIndex }}
    >
      <div className="flex flex-col items-center justify-center space-y-6">
        <img
          src={logoImageBlack}
          alt={SPLASH_SCREEN_TEXT.logoAlt}
          className="loading-screen-logo w-auto max-w-[200px] h-auto"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = document.createElement('div');
            fallback.textContent = SPLASH_SCREEN_TEXT.fallbackText;
            fallback.style.cssText = `font-size: min(8vw, 48px); font-weight: bold; color: var(--primary, ${APP_TEXT_FALLBACK_COLOR}); text-align: center;`;
            target.parentNode?.appendChild(fallback);
          }}
        />
        <div className="relative w-12 h-12 md:w-16 md:h-16">
          <div
            className="absolute inset-0 border-4 rounded-full animate-spin"
            style={{
              borderTopColor: 'var(--primary, #171717)',
              borderRightColor: 'var(--pastel-lavender, #DDD6FE)',
              borderBottomColor: 'var(--pastel-lavender, #DDD6FE)',
              borderLeftColor: 'var(--pastel-lavender, #DDD6FE)',
              display: 'block',
              visibility: 'visible',
              opacity: 1,
              animationDuration: REACT_LOADING_SCREEN.spinner.outer.animationDuration,
            }}
          />
          <div
            className="absolute inset-0 border-4 rounded-full animate-spin"
            style={{
              borderTopColor: 'transparent',
              borderRightColor: 'var(--pastel-sky, #C4B5FD)',
              borderBottomColor: 'var(--pastel-sky, #C4B5FD)',
              borderLeftColor: 'var(--pastel-sky, #C4B5FD)',
              animationDirection: REACT_LOADING_SCREEN.spinner.inner.animationDirection,
              animationDuration: REACT_LOADING_SCREEN.spinner.inner.animationDuration,
              display: 'block',
              visibility: 'visible',
              opacity: 1,
            }}
          />
        </div>
        <p className="text-sm md:text-base font-medium text-foreground">
          {SPLASH_SCREEN_TEXT.loadingMessage}
        </p>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: REACT_LOADING_SCREEN.dots.animationDelays.first }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: REACT_LOADING_SCREEN.dots.animationDelays.second }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: REACT_LOADING_SCREEN.dots.animationDelays.third }} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NativePlatformChrome />
        <Suspense fallback={<AppLoadingFallback />}>
          <AuthenticatedApp />
        </Suspense>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
