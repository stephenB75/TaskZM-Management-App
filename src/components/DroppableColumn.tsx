import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "../lib/utils";
import { useIsMobile } from "./ui/use-mobile";
import { DROPPABLE_COLUMN_MIN_HEIGHT_PX } from "../lib/layout-constants";

interface DroppableColumnProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  /** When true, column body fills remaining height in a flex column layout */
  fillHeight?: boolean;
  /** Override default desktop min-height (px) for equal-height kanban columns */
  bodyMinHeightPx?: number;
}

export function DroppableColumn({
  id,
  children,
  className,
  fillHeight = false,
  bodyMinHeightPx,
}: DroppableColumnProps) {
  const isMobile = useIsMobile();
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: isMobile, // Disable drop on mobile
  });

  return (
    <div
      ref={setNodeRef}
      data-droppable-id={id}
      className={cn(
        "select-none transition-all duration-300",
        isMobile
          ? "min-h-0 [background:transparent!important] [background-color:transparent!important]"
          : fillHeight
            ? "min-h-0 flex flex-col flex-1 h-full"
            : "min-h-[200px]",
        className,
        !isMobile &&
          isOver &&
          "ring-4 ring-primary/80 ring-inset bg-primary/20 scale-[1.02] shadow-xl shadow-primary/20 border-2 border-primary/50",
      )}
      style={{
        // Ensure drop zone is always accessible, even when empty (inline minHeight overrides parent min-h-0)
        position: 'relative',
        zIndex: isOver ? 100 : 'auto',
        ...(isMobile || fillHeight
          ? {}
          : {
              minHeight: bodyMinHeightPx ?? DROPPABLE_COLUMN_MIN_HEIGHT_PX,
            }),
        backgroundColor: isMobile ? 'transparent' : undefined, // Transparent background on mobile to prevent white box
        background: isMobile ? 'transparent' : undefined,
      }}
    >
      {children}
      {/* Drop indicator overlay when dragging over */}
      {!isMobile && isOver && (
        <div 
          className="absolute inset-0 pointer-events-none flex items-center justify-center z-20"
          style={{
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(124, 58, 237, 0.05) 50%, transparent 80%)',
          }}
        >
          <div className="text-primary font-semibold text-sm px-4 py-2 rounded-full bg-primary/20 border-2 border-primary/50 backdrop-blur-md shadow-lg animate-pulse">
            Drop here
          </div>
        </div>
      )}
    </div>
  );
}
