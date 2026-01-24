"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Icon } from "../Icon";
import { CHECKBOX_CHECK_ICON_SIZE, CHECKBOX_CHECK_ICON_SIZE_MOBILE } from "../../lib/layout-constants";

import { cn } from "./utils";

function Checkbox({
  className,
  style,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  // Determine check icon size based on checkbox size from style prop
  const checkboxSize = style?.width || style?.height;
  let checkIconSize = CHECKBOX_CHECK_ICON_SIZE;
  
  if (checkboxSize) {
    const sizeValue = typeof checkboxSize === 'string' 
      ? parseInt(checkboxSize.replace('px', '')) 
      : typeof checkboxSize === 'number' 
        ? checkboxSize 
        : 16;
    // Use larger icon for checkboxes 20px or larger
    if (sizeValue >= 20) {
      checkIconSize = CHECKBOX_CHECK_ICON_SIZE_MOBILE;
    }
  }
  
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border bg-[var(--input-background)] dark:bg-[var(--input-background)] data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        // Default size w-4 h-4, but allow override via className or style
        !style?.width && !style?.height && "w-4 h-4",
        className,
      )}
      style={style}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <Icon name="check" size={checkIconSize} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
