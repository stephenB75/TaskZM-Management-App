"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Icon } from "../Icon";

import { cn } from "./utils";
import { CLOSE_BUTTON, SHEET_SAFE_AREA } from "../../lib/layout-constants";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  return (
    <SheetPrimitive.Overlay
      ref={ref}
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
});
SheetOverlay.displayName = "SheetOverlay";

function getSheetSafeAreaStyle(side: "top" | "right" | "bottom" | "left"): React.CSSProperties {
  if (side === "left") {
    return {
      top: SHEET_SAFE_AREA.top,
      bottom: SHEET_SAFE_AREA.bottom,
      left: SHEET_SAFE_AREA.left,
      height: "auto",
    };
  }
  if (side === "right") {
    return {
      top: SHEET_SAFE_AREA.top,
      bottom: SHEET_SAFE_AREA.bottom,
      right: SHEET_SAFE_AREA.right,
      height: "auto",
    };
  }
  if (side === "top") {
    return {
      top: SHEET_SAFE_AREA.top,
      paddingLeft: SHEET_SAFE_AREA.left,
      paddingRight: SHEET_SAFE_AREA.right,
    };
  }
  return {
    bottom: SHEET_SAFE_AREA.bottom,
    paddingLeft: SHEET_SAFE_AREA.left,
    paddingRight: SHEET_SAFE_AREA.right,
  };
}

function SheetContent({
  className,
  children,
  side = "right",
  style,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  const fullHeightMenu = typeof className === "string" && className.includes("taskzm-sidebar-sheet");
  const safeAreaStyle = fullHeightMenu
    ? { top: 0, right: "auto", bottom: 0, left: 0, height: "100dvh", maxHeight: "100dvh" }
    : getSheetSafeAreaStyle(side);

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right right-0 w-3/4 border-l sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left w-3/4 border-r sm:max-w-sm",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 h-auto border-t",
          className,
        )}
        style={{ ...safeAreaStyle, ...style }}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          data-close-button
          className={CLOSE_BUTTON.className}
          style={{
            width: CLOSE_BUTTON.size,
            height: CLOSE_BUTTON.size,
            minHeight: CLOSE_BUTTON.size,
            top: side === "bottom" ? CLOSE_BUTTON.inset : `calc(${CLOSE_BUTTON.inset} + ${SHEET_SAFE_AREA.top})`,
            right: `calc(${CLOSE_BUTTON.inset} + ${SHEET_SAFE_AREA.right})`,
          }}
        >
          <Icon name="x" size={CLOSE_BUTTON.iconPx} />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
