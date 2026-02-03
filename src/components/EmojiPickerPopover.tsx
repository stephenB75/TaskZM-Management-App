"use client";

import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { ScrollArea } from "./ui/scroll-area";

/** Curated emojis for task title/description – task-relevant and common. No hardcoded UI strings. */
const EMOJI_GRID = [
  "✅", "📋", "📌", "⏰", "🎯", "💡", "📅", "⭐", "🔥", "💪",
  "👍", "📝", "🔔", "📂", "🏷️", "👤", "🕐", "✔️", "❗", "❓",
  "😀", "😊", "🎉", "💼", "📧", "🔗", "📊", "💰", "🏠", "🚀",
  "❤️", "🙏", "✨", "🌟", "💬", "📱", "🖥️", "📈", "🎨", "🔒",
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground", triggerClassName)}
            title={triggerTitle}
            aria-label={triggerTitle}
          >
            <span className="text-base leading-none" aria-hidden>😀</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start" sideOffset={6}>
        <ScrollArea className="h-[200px] w-[240px] pr-2">
          <div className="grid grid-cols-5 gap-0.5">
            {EMOJI_GRID.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                type="button"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded text-lg",
                  "hover:bg-muted focus:bg-muted focus:outline-none"
                )}
                onClick={() => handleSelect(emoji)}
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
