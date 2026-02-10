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

  // Circular thumb: use thumb dimensions (both are 14px for perfect circle)
  const circularThumbSize = TOGGLE_SWITCH_DIMENSIONS.thumb.width; // Both width and height are 14px
  
  // Use calculated thumbOffset for custom sizes, or constant for default sizes
  const checkedOffset = width !== TOGGLE_SWITCH_DIMENSIONS.container.width 
    ? thumbOffset 
    : TOGGLE_SWITCH_DIMENSIONS.thumbOffset.checked;

  return (
    <label 
      className={cn(
        "peer relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{
        height: `${height}px`,
        width: `${width}px`,
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
      {/* Background track */}
      <span
        className={cn(
          "absolute inset-0 rounded-full transition-colors duration-200 ease-in-out",
          isChecked ? TOGGLE_SWITCH_COLORS.switch.background.checked : TOGGLE_SWITCH_COLORS.switch.background.unchecked,
          "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
        )}
        style={{
          height: `${height}px`,
          width: `${width}px`,
        }}
        aria-hidden="true"
      />
      {/* Sliding thumb - circular (pill-shaped container, circular thumb) */}
      <span
        className={cn(
          "pointer-events-none absolute rounded-full shadow-md ring-0 transition-[left] duration-200 ease-in-out",
          TOGGLE_SWITCH_COLORS.switch.thumb.light,
          TOGGLE_SWITCH_COLORS.switch.thumb.dark,
        )}
        style={{
          // Circular thumb: perfectly circular, perfectly centered
          height: `${circularThumbSize}px`,
          width: `${circularThumbSize}px`,
          // Perfect vertical centering: (container height - thumb height) / 2
          top: `${(height - circularThumbSize) / 2}px`,
          // Perfect horizontal positioning: use calculated offset for custom sizes, constant for defaults
          left: isChecked 
            ? `${checkedOffset}px` 
            : `${TOGGLE_SWITCH_DIMENSIONS.thumbOffset.unchecked}px`,
          // Remove transform to avoid subpixel rendering issues on mobile
        }}
        aria-hidden="true"
      />
    </label>
  );
}

export { CheckboxSwitch };
