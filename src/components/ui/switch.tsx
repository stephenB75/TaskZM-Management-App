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
        // Pill-shaped background container
        "relative inline-flex items-center rounded-full transition-colors ease-in-out",
        TOGGLE_SWITCH_ANIMATIONS.durationClass,
        "focus:outline-none",
        `focus-visible:${TOGGLE_SWITCH_EFFECTS.focusRing.widthClass}`,
        "focus-visible:ring-ring",
        `focus-visible:${TOGGLE_SWITCH_EFFECTS.focusRing.offsetClass}`,
        "focus-visible:ring-offset-background",
        "touch-manipulation select-none",
        // Sizing - pill shape (slightly taller for better proportions)
        "h-7 w-12", // Using fixed Tailwind classes as dynamic classes don't work
        // Background colors - inverted for dark mode
        isChecked ? TOGGLE_SWITCH_COLORS.switch.background.checked : TOGGLE_SWITCH_COLORS.switch.background.unchecked,
        // Disabled state
        disabled && `${TOGGLE_SWITCH_EFFECTS.opacity.disabledClass} cursor-not-allowed`,
        !disabled && "cursor-pointer",
        className
      )}
      style={{
        WebkitTapHighlightColor: 'transparent',
        borderRadius: `${TOGGLE_SWITCH_DIMENSIONS.container.height / 2}px`, // Pill shape: half the height
      }}
    >
      {/* Sliding thumb - pill shaped */}
      <span
        className={cn(
          `absolute block ${TOGGLE_SWITCH_EFFECTS.shadow.md} transition-transform ease-in-out rounded-full`,
          TOGGLE_SWITCH_COLORS.switch.thumb.light,
          TOGGLE_SWITCH_COLORS.switch.thumb.dark,
          TOGGLE_SWITCH_ANIMATIONS.durationClass,
        )}
        style={{
          width: `${TOGGLE_SWITCH_DIMENSIONS.thumb.width}px`,
          height: `${TOGGLE_SWITCH_DIMENSIONS.thumb.height}px`,
          borderRadius: `${TOGGLE_SWITCH_DIMENSIONS.thumb.height / 2}px`, // Pill shape: half the height (circular)
          top: `${(TOGGLE_SWITCH_DIMENSIONS.container.height - TOGGLE_SWITCH_DIMENSIONS.thumb.height) / 2}px`, // Center vertically
          left: isChecked 
            ? `${TOGGLE_SWITCH_DIMENSIONS.thumbOffset.checked}px` 
            : `${TOGGLE_SWITCH_DIMENSIONS.thumbOffset.unchecked}px`,
        }}
        aria-hidden="true"
      />
    </button>
  );
}

export { Switch };
