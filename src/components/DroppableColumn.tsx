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
        "select-none transition-all duration-300 min-h-[200px]",
        className,
        !isMobile &&
          isOver &&
          "ring-2 ring-primary/60 ring-inset bg-primary/15 scale-[1.02] shadow-lg shadow-primary/10",
      )}
      style={{
        // Ensure drop zone is always accessible, even when empty
        position: 'relative',
      }}
    >
      {children}
      {/* Drop indicator overlay when dragging over */}
      {!isMobile && isOver && (
        <div 
          className="absolute inset-0 pointer-events-none flex items-center justify-center z-10"
          style={{
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 70%)',
          }}
        >
          <div className="text-primary/60 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 backdrop-blur-sm">
            Drop here
          </div>
        </div>
      )}
    </div>
  );
}