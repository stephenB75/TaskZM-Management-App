import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 dark:hover:bg-primary/80 shadow-sm hover:shadow-md [&_svg]:text-primary-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:hover:bg-destructive/80 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [&_svg]:text-destructive-foreground",
        outline:
          "border-2 border-primary/30 dark:border-primary/50 bg-white dark:bg-card text-foreground dark:text-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/50 dark:hover:bg-accent dark:hover:text-foreground dark:hover:border-primary/70 [&_svg]:text-foreground dark:[&_svg]:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border border-secondary/50 hover:bg-secondary/90 hover:border-secondary/70 dark:bg-secondary dark:text-secondary-foreground dark:border-secondary/50 dark:hover:bg-secondary/70 dark:hover:border-secondary/70 [&_svg]:text-secondary-foreground",
        ghost:
          "text-foreground dark:text-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/60 [&_svg]:text-foreground dark:[&_svg]:text-foreground",
        link: "text-primary underline-offset-4 hover:underline [&_svg]:text-primary",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
