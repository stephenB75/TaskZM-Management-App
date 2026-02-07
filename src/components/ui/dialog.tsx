"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Icon } from "../Icon";

import { cn } from "./utils";
import { UI_GRADIENT_COLORS } from "../../lib/ui-colors";
import { DIALOG_CLOSE_BUTTON } from "../../lib/layout-constants";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 dark:bg-black/70",
        className,
      )}
      {...props}
    />
));

DialogOverlay.displayName = "DialogOverlay";

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  hideCloseButton?: boolean;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, hideCloseButton, ...props }, ref) => (
  <DialogPortal data-slot="dialog-portal">
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-slot="dialog-content"
      className={cn(
        `${UI_GRADIENT_COLORS.dialog.className} dark:from-[#1A1A2E] dark:via-[#252538] dark:to-[#2A2A3E] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-primary/25 dark:border-primary/40 shadow-lg duration-200 text-foreground dark:text-foreground`,
        // Mobile: smaller padding and max-width, Desktop: standard
        'max-w-[calc(100%-2rem)] p-4 sm:max-w-lg sm:p-6', // Mobile: 1rem padding, 2rem margin from edges; Desktop: standard
        className,
      )}
      onInteractOutside={(e) => {
        // Allow Select dropdowns to work - don't close dialog when clicking on SelectContent
        const target = e.target as HTMLElement;
        if (target?.closest('[data-slot="select-content"]') || 
            target?.closest('[data-radix-select-content]') ||
            target?.closest('[data-radix-select-viewport]')) {
          e.preventDefault();
        }
      }}
      {...props}
    >
      {children}
      {!hideCloseButton && (
      <DialogPrimitive.Close 
        className={cn(
          "ring-offset-background focus:ring-ring absolute rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none text-foreground/70 hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 flex items-center justify-center p-0",
          // Mobile: use mobile constants via inline styles, Desktop: use Tailwind classes
          "sm:w-8 sm:h-8 sm:top-4 sm:right-4"
        )}
        style={{
          width: DIALOG_CLOSE_BUTTON.mobile.size,
          height: DIALOG_CLOSE_BUTTON.mobile.size,
          top: DIALOG_CLOSE_BUTTON.mobile.top,
          right: DIALOG_CLOSE_BUTTON.mobile.right,
          padding: DIALOG_CLOSE_BUTTON.mobile.padding,
        }}
      >
        <Icon 
          name="x" 
          size={parseInt(DIALOG_CLOSE_BUTTON.mobile.iconSize.replace('rem', '')) * 16}
          className="sm:hidden"
          style={{
            width: DIALOG_CLOSE_BUTTON.mobile.iconSize,
            height: DIALOG_CLOSE_BUTTON.mobile.iconSize,
          }}
        />
        <Icon 
          name="x" 
          size={parseInt(DIALOG_CLOSE_BUTTON.desktop.iconSize.replace('rem', '')) * 16}
          className="hidden sm:block"
          style={{
            width: DIALOG_CLOSE_BUTTON.desktop.iconSize,
            height: DIALOG_CLOSE_BUTTON.desktop.iconSize,
          }}
        />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));

DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold text-foreground dark:text-foreground", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm dark:text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
