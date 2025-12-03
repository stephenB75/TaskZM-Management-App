"use client";

import * as React from "react";
import { cn } from "./utils";
import { TOGGLE_SWITCH_DIMENSIONS, TOGGLE_SWITCH_ANIMATIONS, TOGGLE_SWITCH_EFFECTS } from "../../lib/layout-constants";
import { TOGGLE_SWITCH_COLORS } from "../../lib/ui-colors";

interface SwitchProps {
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function Switch({
  id,
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  className,
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
  
  // Use controlled checked if provided, otherwise use internal state
  const isChecked = controlledChecked !== undefined ? controlledChecked : internalChecked;
  
  const handleToggle = () => {
    if (disabled) return;
    
    const newChecked = !isChecked;
    
    // Update internal state if not controlled
    if (controlledChecked === undefined) {
      setInternalChecked(newChecked);
    }
    
    // Call onChange handler
    onCheckedChange?.(newChecked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={isChecked}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        // Standard toggle switch container
        "peer relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Background colors
        isChecked ? TOGGLE_SWITCH_COLORS.switch.background.checked : TOGGLE_SWITCH_COLORS.switch.background.unchecked,
        className
      )}
      style={{
        width: `${TOGGLE_SWITCH_DIMENSIONS.container.width}px`,
        height: `${TOGGLE_SWITCH_DIMENSIONS.container.height}px`,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Sliding thumb - circular (pill-shaped container, circular thumb) */}
      <span
        className={cn(
          "pointer-events-none absolute inline-block rounded-full shadow-md ring-0 transition-transform duration-200 ease-in-out",
          TOGGLE_SWITCH_COLORS.switch.thumb.light,
          TOGGLE_SWITCH_COLORS.switch.thumb.dark,
        )}
        style={{
          // Circular thumb: perfectly circular, centered vertically and horizontally with proper padding
          height: `${TOGGLE_SWITCH_DIMENSIONS.thumb.height}px`,
          width: `${TOGGLE_SWITCH_DIMENSIONS.thumb.width}px`,
          top: `${(TOGGLE_SWITCH_DIMENSIONS.container.height - TOGGLE_SWITCH_DIMENSIONS.thumb.height) / 2}px`,
          left: `${TOGGLE_SWITCH_DIMENSIONS.thumbOffset.unchecked}px`,
          // Transform to checked position: move from left (2px) to right (32px) = 30px translation
          transform: isChecked 
            ? `translateX(${TOGGLE_SWITCH_DIMENSIONS.thumbOffset.checked - TOGGLE_SWITCH_DIMENSIONS.thumbOffset.unchecked}px)` 
            : `translateX(0px)`,
        }}
        aria-hidden="true"
      />
    </button>
  );
}

export { Switch };
