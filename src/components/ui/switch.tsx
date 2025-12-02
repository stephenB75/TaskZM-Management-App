"use client";

import * as React from "react";
import { cn } from "./utils";

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
        "relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "touch-manipulation select-none",
        // Sizing - pill shape (slightly taller for better proportions)
        "h-7 w-12",
        // Background colors - inverted for dark mode
        isChecked ? "bg-primary dark:bg-primary" : "bg-[var(--switch-background)] dark:bg-gray-600",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer",
        className
      )}
      style={{
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Sliding thumb - pill shaped */}
      <span
        className={cn(
          "block bg-white dark:bg-gray-200 shadow-md transition-transform duration-200 ease-in-out",
          // Pill shape - rounded-full on a rectangular element creates pill shape
          "rounded-full",
          // Thumb sizing - wider for pill shape (h-4 = 16px, w-6 = 24px)
          "h-4 w-6",
          // Position - moves from left to right with padding
          // Container is w-12 (48px), thumb is w-6 (24px)
          // Left: 2px padding, Right: 48px - 24px - 2px = 22px
          isChecked 
            ? "translate-x-[22px]" 
            : "translate-x-0.5"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

export { Switch };
