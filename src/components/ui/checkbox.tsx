"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Icon } from "../Icon";
import {
  CHECKBOX_AND_MARK_COMPLETE_SIZE_PX,
  CHECKBOX_CHECK_ICON_SIZE,
  CHECKBOX_CHECK_ICON_SIZE_MOBILE,
} from "../../lib/layout-constants";

import { cn } from "./utils";

const DEFAULT_CHECKBOX_SIZE_PX = CHECKBOX_AND_MARK_COMPLETE_SIZE_PX.desktop;
const CHECKBOX_THRESHOLD_LARGE_ICON_PX = CHECKBOX_AND_MARK_COMPLETE_SIZE_PX.tablet;

function Checkbox({
  className,
  style,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const checkboxSize = style?.width || style?.height;
  const sizeValue = checkboxSize
    ? typeof checkboxSize === 'string'
      ? parseInt(checkboxSize.replace('px', ''), 10)
      : typeof checkboxSize === 'number'
        ? checkboxSize
        : DEFAULT_CHECKBOX_SIZE_PX
    : DEFAULT_CHECKBOX_SIZE_PX;
  const checkIconSize = sizeValue >= CHECKBOX_THRESHOLD_LARGE_ICON_PX
    ? CHECKBOX_CHECK_ICON_SIZE_MOBILE
    : CHECKBOX_CHECK_ICON_SIZE;

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border bg-[var(--input-background)] dark:bg-[var(--input-background)] data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        !style?.width && !style?.height && "shrink-0",
        className,
      )}
      style={{
        ...(style || {}),
        ...(!style?.width && !style?.height ? { width: DEFAULT_CHECKBOX_SIZE_PX, height: DEFAULT_CHECKBOX_SIZE_PX, minWidth: DEFAULT_CHECKBOX_SIZE_PX, minHeight: DEFAULT_CHECKBOX_SIZE_PX } : {}),
      }}
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
