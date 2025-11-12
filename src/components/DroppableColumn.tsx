import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "../lib/utils";
import { useIsMobile } from "./ui/use-mobile";

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function DroppableColumn({
  id,
  children,
  className,
}: DroppableColumnProps) {
  const isMobile = useIsMobile();
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: isMobile, // Disable drop on mobile
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "select-none transition-all duration-200",
        className,
        !isMobile &&
          isOver &&
          "ring-2 ring-primary/50 ring-inset bg-primary/10 scale-[1.02]",
      )}
    >
      {children}
    </div>
  );
}