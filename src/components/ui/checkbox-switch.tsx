"use client";

import * as React from "react";
import { cn } from "./utils";
import { TOGGLE_SWITCH_DIMENSIONS, TOGGLE_SWITCH_ANIMATIONS, TOGGLE_SWITCH_EFFECTS } from "../../lib/layout-constants";
import { TOGGLE_SWITCH_COLORS } from "../../lib/ui-colors";

interface CheckboxSwitchProps {
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function CheckboxSwitch({
  id,
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  className,
}: CheckboxSwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
  
  // Use controlled checked if provided, otherwise use internal state
  const isChecked = controlledChecked !== undefined ? controlledChecked : internalChecked;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const newChecked = e.target.checked;
    
    // Update internal state if not controlled
    if (controlledChecked === undefined) {
      setInternalChecked(newChecked);
    }
    
    // Call onChange handler
    onCheckedChange?.(newChecked);
  };

  // Extract width and height from className if provided, otherwise use defaults matching Switch component
  const getDimensions = () => {
    // Check if className contains size overrides (e.g., "h-6 w-11" or "h-7 w-12")
    const sizeMatch = className?.match(/(?:^|\s)(?:h-(\d+)|w-(\d+))/g);
    if (sizeMatch) {
      let width = TOGGLE_SWITCH_DIMENSIONS.container.width; // Default to match Switch component
      let height = TOGGLE_SWITCH_DIMENSIONS.container.height; // Default to match Switch component
      sizeMatch.forEach(match => {
        if (match.includes('w-')) {
          const wMatch = match.match(/w-(\d+)/);
          if (wMatch) width = parseInt(wMatch[1]) * 4; // Convert Tailwind units to px
        }
        if (match.includes('h-')) {
          const hMatch = match.match(/h-(\d+)/);
          if (hMatch) height = parseInt(hMatch[1]) * 4; // Convert Tailwind units to px
        }
      });
      // Calculate thumb size and offset to match Switch component
      const thumbHeight = TOGGLE_SWITCH_DIMENSIONS.thumb.height;
      const thumbWidth = TOGGLE_SWITCH_DIMENSIONS.thumb.width;
      // Offset calculation: width - thumbWidth - unchecked offset padding
      const thumbOffset = width - thumbWidth - TOGGLE_SWITCH_DIMENSIONS.thumbOffset.unchecked;
      return { width, height, thumbHeight, thumbWidth, thumbOffset };
    }
    // Default dimensions matching Switch component
    return { 
      width: TOGGLE_SWITCH_DIMENSIONS.container.width, 
      height: TOGGLE_SWITCH_DIMENSIONS.container.height, 
      thumbHeight: TOGGLE_SWITCH_DIMENSIONS.thumb.height, 
      thumbWidth: TOGGLE_SWITCH_DIMENSIONS.thumb.width, 
      thumbOffset: TOGGLE_SWITCH_DIMENSIONS.thumbOffset.checked 
    };
  };

  const { width, height, thumbHeight, thumbWidth, thumbOffset } = getDimensions();

  return (
    <label 
      className={cn(
        "relative inline-flex items-center rounded-full transition-colors ease-in-out",
        TOGGLE_SWITCH_ANIMATIONS.durationClass,
        "focus:outline-none",
        `focus-visible:${TOGGLE_SWITCH_EFFECTS.focusRing.widthClass}`,
        "focus-visible:ring-ring",
        `focus-visible:${TOGGLE_SWITCH_EFFECTS.focusRing.offsetClass}`,
        "focus-visible:ring-offset-background",
        "touch-manipulation select-none",
        disabled ? `${TOGGLE_SWITCH_EFFECTS.opacity.disabledClass} cursor-not-allowed` : "cursor-pointer",
        className
      )}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${height / 2}px`, // Pill shape: half the height
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={isChecked}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only peer"
      />
      <div 
        className={cn(
          "absolute inset-0 rounded-full transition-colors ease-in-out",
          TOGGLE_SWITCH_ANIMATIONS.durationClass,
          isChecked ? TOGGLE_SWITCH_COLORS.switch.background.checked : TOGGLE_SWITCH_COLORS.switch.background.unchecked,
          `peer-focus-visible:${TOGGLE_SWITCH_EFFECTS.focusRing.widthClass}`,
          "peer-focus-visible:ring-ring",
          `peer-focus-visible:${TOGGLE_SWITCH_EFFECTS.focusRing.offsetClass}`,
          `peer-disabled:${TOGGLE_SWITCH_EFFECTS.opacity.disabledClass} peer-disabled:cursor-not-allowed`
        )}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${height / 2}px`, // Pill shape: half the height
        }}
      >
        {/* Sliding thumb - pill shaped, matching Switch component */}
        <span
          className={cn(
            `absolute block ${TOGGLE_SWITCH_EFFECTS.shadow.md} transition-transform ease-in-out rounded-full`,
            TOGGLE_SWITCH_COLORS.switch.thumb.light,
            TOGGLE_SWITCH_COLORS.switch.thumb.dark,
            TOGGLE_SWITCH_ANIMATIONS.durationClass
          )}
          style={{
            width: `${thumbWidth}px`,
            height: `${thumbHeight}px`,
            borderRadius: `${thumbHeight / 2}px`, // Pill shape: half the height (circular)
            top: `${(height - thumbHeight) / 2}px`, // Center vertically
            left: isChecked ? `${thumbOffset}px` : `${TOGGLE_SWITCH_DIMENSIONS.thumbOffset.unchecked}px`, // Use constant for unchecked padding
          }}
          aria-hidden="true"
        />
      </div>
    </label>
  );
}

export { CheckboxSwitch };
