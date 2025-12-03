"use client";

import * as React from "react";
import { cn } from "./utils";

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
      let width = 48; // Default w-12 (48px) to match Switch component
      let height = 28; // Default h-7 (28px) to match Switch component
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
      // Thumb is h-4 w-6 (16px height, 24px width) in Switch component
      const thumbHeight = 16; // h-4
      const thumbWidth = 24; // w-6
      // Offset calculation: width - thumbWidth - 2px padding on right, or 0.5 (2px) on left
      const thumbOffset = width - thumbWidth - 2; // 48 - 24 - 2 = 22px when checked
      return { width, height, thumbHeight, thumbWidth, thumbOffset };
    }
    // Default dimensions matching Switch component: h-7 w-12
    return { width: 48, height: 28, thumbHeight: 16, thumbWidth: 24, thumbOffset: 22 };
  };

  const { width, height, thumbHeight, thumbWidth, thumbOffset } = getDimensions();

  return (
    <label 
      className={cn(
        "relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "touch-manipulation select-none",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className
      )}
      style={{
        width: `${width}px`,
        height: `${height}px`,
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
          "absolute inset-0 rounded-full transition-colors duration-200 ease-in-out",
          isChecked ? "bg-primary dark:bg-primary" : "bg-[var(--switch-background)] dark:bg-gray-600",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
        )}
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* Sliding thumb - pill shaped, matching Switch component */}
        <span
          className={cn(
            "absolute block bg-white dark:bg-gray-200 shadow-md transition-transform duration-200 ease-in-out rounded-full"
          )}
          style={{
            width: `${thumbWidth}px`,
            height: `${thumbHeight}px`,
            top: `${(height - thumbHeight) / 2}px`, // Center vertically
            left: isChecked ? `${thumbOffset}px` : '2px', // 2px padding when unchecked, calculated offset when checked
          }}
          aria-hidden="true"
        />
      </div>
    </label>
  );
}

export { CheckboxSwitch };
