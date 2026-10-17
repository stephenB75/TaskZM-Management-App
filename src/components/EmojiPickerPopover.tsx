"use client";

import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "../lib/utils";
import { Icon } from "./Icon";
import { ICON_SIZE_MD } from "../lib/layout-constants";
import { EMOJI_SECTIONS } from "../lib/emoji-constants";

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
  const [sectionId, setSectionId] = useState(EMOJI_SECTIONS[0].id);
  const section = EMOJI_SECTIONS.find((item) => item.id === sectionId) ?? EMOJI_SECTIONS[0];

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
      <PopoverContent className="w-[18rem] max-w-[calc(100vw-1rem)] rounded-2xl p-1.5" align="end" sideOffset={6}>
        <div
          className="mb-1.5 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Emoji sections"
        >
          {EMOJI_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === section.id}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                item.id === section.id && "bg-foreground text-background hover:bg-foreground hover:text-background",
              )}
              onClick={() => setSectionId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto" role="tabpanel" aria-label={section.label}>
          {section.emojis.map((emoji) => (
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
