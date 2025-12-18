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
        "select-none transition-all duration-300",
        isMobile ? "min-h-0" : "min-h-[200px]", // No min-height on mobile to prevent white box
        className,
        !isMobile &&
          isOver &&
          "ring-4 ring-primary/80 ring-inset bg-primary/20 scale-[1.02] shadow-xl shadow-primary/20 border-2 border-primary/50",
      )}
      style={{
        // Ensure drop zone is always accessible, even when empty
        position: 'relative',
        zIndex: isOver ? 100 : 'auto',
        backgroundColor: isMobile ? 'transparent' : undefined, // Transparent background on mobile to prevent white box
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