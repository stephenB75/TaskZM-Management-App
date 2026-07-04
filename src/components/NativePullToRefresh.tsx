/**
 * Native pull-to-refresh for iOS/Android scroll containers.
 */

import React, { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Capacitor } from '@capacitor/core';
import { Icon } from '../components/Icon';
import { MOBILE_PULL_TO_REFRESH } from '../lib/mobile-constants';
import { triggerSuccessHaptic } from '../lib/native-haptics';
import { Z_INDEX } from '../lib/layout-constants';

interface NativePullToRefreshProps {
  scrollRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function NativePullToRefresh({
  scrollRef,
  enabled,
  onRefresh,
  children,
}: NativePullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);

  const isNative = Capacitor.isNativePlatform();
  const active = enabled && isNative;

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!active || isRefreshing) return;
      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      if (scrollTop > 0) return;

      touchStartY.current = event.touches[0]?.clientY ?? 0;
      pulling.current = true;
    },
    [active, isRefreshing, scrollRef],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!active || !pulling.current || isRefreshing) return;

      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      if (scrollTop > 0) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }

      const currentY = event.touches[0]?.clientY ?? 0;
      const delta = Math.max(0, currentY - touchStartY.current);
      const resisted = Math.min(
        MOBILE_PULL_TO_REFRESH.maxPullPx,
        delta * MOBILE_PULL_TO_REFRESH.resistance,
      );
      setPullDistance(resisted);
    },
    [active, isRefreshing, scrollRef],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!active || !pulling.current) return;
    pulling.current = false;

    if (pullDistance >= MOBILE_PULL_TO_REFRESH.thresholdPx && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(MOBILE_PULL_TO_REFRESH.thresholdPx);

      try {
        await onRefresh();
        await triggerSuccessHaptic();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
      return;
    }

    setPullDistance(0);
  }, [active, isRefreshing, onRefresh, pullDistance]);

  const showIndicator = active && (pullDistance > 0 || isRefreshing);
  const progress = Math.min(1, pullDistance / MOBILE_PULL_TO_REFRESH.thresholdPx);

  return (
    <div
      className="relative flex flex-col flex-1 min-h-0 min-w-0 w-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => {
        void handleTouchEnd();
      }}
      onTouchCancel={() => {
        pulling.current = false;
        if (!isRefreshing) setPullDistance(0);
      }}
    >
      {showIndicator ? (
        <div
          className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
          style={{
            zIndex: Z_INDEX.NAV_BAR - 1,
            top: 0,
            height: `${Math.max(pullDistance, isRefreshing ? MOBILE_PULL_TO_REFRESH.thresholdPx : 0)}px`,
            transition: isRefreshing ? 'height 150ms ease-out' : undefined,
          }}
          aria-hidden
        >
          <Icon
            name="refresh-cw"
            size={22}
            className={isRefreshing ? 'animate-spin text-primary' : 'text-primary'}
            style={{
              opacity: progress,
              transform: `rotate(${progress * 180}deg)`,
            }}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
