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
        // Sizing - pill shape
        "h-6 w-11",
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
      {/* Sliding thumb */}
      <span
        className={cn(
          "block rounded-full bg-white dark:bg-gray-200 shadow-md transition-transform duration-200 ease-in-out",
          // Thumb sizing
          "h-5 w-5",
          // Position - moves from left to right
          isChecked 
            ? "translate-x-5" 
            : "translate-x-1"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

export { Switch };
