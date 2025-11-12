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
        // Sizing - pill shape with 2:1 ratio
        "h-5 w-10",
        "md:h-6 md:w-12",
        // Background colors
        isChecked ? "bg-primary" : "bg-switch-background",
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
          "block rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out",
          // Mobile sizing
          "h-4 w-4",
          "md:h-5 md:w-5",
          // Position - moves from left to right
          isChecked 
            ? "translate-x-5 md:translate-x-[1.625rem]" 
            : "translate-x-0.5"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

export { Switch };
