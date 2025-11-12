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

  return (
    <label className={cn("relative inline-block", className)} style={{
      width: '44px',
      height: '24px',
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
          "absolute inset-0 rounded-full transition-colors duration-200 cursor-pointer",
          "peer-checked:bg-primary peer-unchecked:bg-switch-background",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
        )}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
        }}
      >
        <div 
          className={cn(
            "absolute top-[2px] left-[2px] bg-white rounded-full shadow-md transition-transform duration-200",
            "peer-checked:translate-x-[20px]"
          )}
          style={{
            width: '20px',
            height: '20px',
            transform: isChecked ? 'translateX(20px)' : 'translateX(0)',
          }}
        />
      </div>
    </label>
  );
}

export { CheckboxSwitch };
