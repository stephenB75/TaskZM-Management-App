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

  // Extract width and height from className if provided, otherwise use defaults
  const getDimensions = () => {
    // Check if className contains size overrides (e.g., "h-6 w-11" or "h-7 w-12")
    const sizeMatch = className?.match(/(?:^|\s)(?:h-(\d+)|w-(\d+))/g);
    if (sizeMatch) {
      let width = 44;
      let height = 24;
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
      // Calculate thumb size and offset
      const thumbSize = height - 4; // 20px for standard 24px height
      const thumbOffset = width - thumbSize - 2; // Move thumb to right with 2px padding
      return { width, height, thumbSize, thumbOffset };
    }
    return { width: 44, height: 24, thumbSize: 20, thumbOffset: 22 };
  };

  const { width, height, thumbSize, thumbOffset } = getDimensions();
  // Rounded rectangle: use 12px border radius (half of standard height) for significantly rounded corners
  // This creates a rounded rectangle appearance, not a true pill
  const borderRadius = 12;

  return (
    <label className={cn("relative inline-block", className)} style={{
      width: `${width}px`,
      height: `${height}px`,
    }}>
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
          "absolute inset-0 transition-colors duration-200 cursor-pointer",
          "peer-checked:bg-primary dark:peer-checked:bg-primary peer-unchecked:bg-gray-300 dark:peer-unchecked:bg-gray-600",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
        )}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${borderRadius}px`, // Rounded rectangle with significantly rounded corners
        }}
      >
        <div 
          className={cn(
            "absolute bg-white dark:bg-gray-200 shadow-md transition-transform duration-200"
          )}
          style={{
            width: `${thumbSize}px`,
            height: `${thumbSize}px`,
            top: '2px',
            left: '2px',
            borderRadius: '50%', // Perfectly circular thumb
            transform: isChecked ? `translateX(${thumbOffset}px)` : 'translateX(0)',
          }}
        />
      </div>
    </label>
  );
}

export { CheckboxSwitch };
