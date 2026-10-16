"use client";

import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "../lib/utils";
import { Icon } from "./Icon";
import { ICON_SIZE_MD } from "../lib/layout-constants";

/** Small curated set of task markers (status, time, context) so the picker fits without scrolling. */
const TASK_EMOJIS = [
  "✅", "📌", "⏰", "🎯", "🔥", "⭐",
  "💡", "📝", "📅", "💼", "🏠", "🚀",
];

export interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void;
  triggerClassName?: string;
  triggerTitle?: string;
  children?: React.ReactNode;
}

export function EmojiPickerPopover({
  onSelect,
  triggerClassName,
  triggerTitle = "Insert emoji",
  children,
}: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              open && "bg-muted text-foreground",
              triggerClassName,
            )}
            title={triggerTitle}
            aria-label={triggerTitle}
          >
            <Icon name="smiley-wink" size={ICON_SIZE_MD} />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-2xl p-1.5" align="end" sideOffset={6}>
        <div className="grid grid-cols-6 gap-0.5">
          {TASK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg hover:bg-muted focus:bg-muted focus:outline-none"
              onClick={() => handleSelect(emoji)}
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
