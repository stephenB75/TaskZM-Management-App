"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { Icon } from "../Icon";

import { cn } from "./utils";
import { buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        caption: "flex justify-center pt-2 pb-3 relative items-center w-full",
        caption_label: "text-sm font-semibold text-gray-900 dark:text-foreground",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-7 bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-accent",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse table-fixed",
        head_row: "grid grid-cols-7 w-full mb-1",
        head_cell:
          "text-gray-600 dark:text-muted-foreground rounded-md font-normal text-[0.8rem] text-center p-0 h-8",
        row: "grid grid-cols-7 w-full mt-0.5",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-normal aria-selected:opacity-100 w-9 h-9 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "bg-gray-200 dark:bg-muted text-gray-900 dark:text-foreground hover:bg-gray-300 dark:hover:bg-muted/80 hover:text-gray-900 dark:hover:text-foreground focus:bg-gray-200 dark:focus:bg-muted focus:text-gray-900 dark:focus:text-foreground focus:outline-none focus:ring-0 font-medium rounded-md",
        day_today: "bg-gray-100 dark:bg-card text-gray-900 dark:text-foreground font-medium",
        day_focus:
          "bg-gray-200 dark:bg-muted text-gray-900 dark:text-foreground focus:outline-none focus:ring-0 rounded-md",
        day_outside:
          "day-outside text-gray-400 dark:text-muted-foreground aria-selected:text-gray-400 dark:aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <Icon name="chevron-left" size={16} className={cn("size-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <Icon name="chevron-right" size={16} className={cn("size-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
