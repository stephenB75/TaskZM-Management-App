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
        caption_label: "text-sm font-semibold text-gray-900 dark:text-gray-100",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-7 bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-accent dark:text-gray-200 dark:hover:bg-white/10",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse table-fixed",
        head_row: "grid grid-cols-7 w-full mb-1",
        head_cell:
          "text-gray-600 dark:text-gray-400 rounded-md font-normal text-[0.8rem] text-center p-0 h-8",
        row: "grid grid-cols-7 w-full mt-0.5",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-normal aria-selected:opacity-100 w-9 h-9 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-100 transition-colors flex items-center justify-center",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "bg-gray-200 dark:bg-primary dark:text-primary-foreground text-gray-900 hover:bg-gray-300 dark:hover:bg-primary/90 hover:text-gray-900 dark:hover:text-primary-foreground focus:bg-gray-200 dark:focus:bg-primary focus:text-gray-900 dark:focus:text-primary-foreground focus:outline-none focus:ring-0 font-medium rounded-md",
        day_today: "bg-gray-100 dark:bg-gray-700 dark:text-gray-100 text-gray-900 font-medium",
        day_focus:
          "bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0 rounded-md",
        day_outside:
          "day-outside text-gray-400 dark:text-gray-500 aria-selected:text-gray-400 dark:aria-selected:text-gray-400",
        day_disabled: "text-muted-foreground dark:text-gray-500 opacity-50 cursor-not-allowed",
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
