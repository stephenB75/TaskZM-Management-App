import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { Icon } from './Icon';
import { cn } from './ui/utils';
import { triggerSelectionHaptic } from '../lib/native-haptics';
import { CLOSE_BUTTON, ICON_SIZE_SM, MOBILE_HOME_TAB_FONT_SIZE, TASK_OPTION_SHEET } from '../lib/layout-constants';
import {
  TASK_DIALOG_COLORS,
  TASK_DIALOG_OPTIONS,
  TASK_DIALOG_OPTION_SHEET_TEXT,
  type TaskDialogOptionId,
} from '../lib/task-dialog-constants';

export interface TaskOptionBarItem {
  id: TaskDialogOptionId;
  /** Count badge (e.g. 3 subtasks) or a dot when true. */
  indicator?: number | boolean;
  accentColor?: string;
}

interface TaskOptionBarProps {
  items: TaskOptionBarItem[];
  activeId: TaskDialogOptionId | null;
  onSelect: (id: TaskDialogOptionId) => void;
}

/** Inline row of option icons shown under the task notes. */
export function TaskOptionBar({ items, activeId, onSelect }: TaskOptionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={TASK_DIALOG_OPTION_SHEET_TEXT.optionsLabel}
      className={cn('grid gap-1', TASK_DIALOG_COLORS.optionTray)}
      style={{ gridTemplateColumns: `repeat(${Math.min(items.length, TASK_OPTION_SHEET.barColumns)}, minmax(0, 1fr))` }}
    >
      {items.map(({ id, indicator, accentColor }) => {
        const option = TASK_DIALOG_OPTIONS[id];
        const active = activeId === id;
        const count = typeof indicator === 'number' && indicator > 0 ? indicator : null;
        const dot = indicator === true;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => {
              void triggerSelectionHaptic();
              onSelect(id);
            }}
            className={cn(
              'relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 transition-colors',
              active ? TASK_DIALOG_COLORS.optionActive : TASK_DIALOG_COLORS.optionInactive,
            )}
          >
            <span className="relative">
              <Icon
                name={option.iconName}
                size={TASK_OPTION_SHEET.iconPx}
                weight={active ? 'fill' : 'regular'}
                style={accentColor && !active ? { color: accentColor } : undefined}
                aria-hidden
              />
              {count !== null && (
                <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-md bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">
                  {count}
                </span>
              )}
              {dot && <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-primary" aria-hidden />}
            </span>
            <span className="w-full truncate text-center font-medium leading-none" style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE }}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface TaskOptionSheetProps {
  activeId: TaskDialogOptionId | null;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Slides up over the lower part of the task dialog, beneath the notes.
 * Drag the handle up to fill the dialog; drag down to shrink or close.
 */
export function TaskOptionSheet({ activeId, onClose, children }: TaskOptionSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => {
    if (!activeId) setExpanded(false);
  }, [activeId]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -TASK_OPTION_SHEET.dragThresholdPx) {
      setExpanded(true);
    } else if (info.offset.y > TASK_OPTION_SHEET.dragThresholdPx) {
      if (expanded) setExpanded(false);
      else onClose();
    }
  };

  const option = activeId ? TASK_DIALOG_OPTIONS[activeId] : null;

  return (
    <AnimatePresence>
      {activeId && option && (
        <motion.section
          key="task-option-sheet"
          role="region"
          aria-label={option.title}
          data-task-option-sheet={activeId}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'tween', ease: 'easeOut', duration: TASK_OPTION_SHEET.slideSeconds }}
          drag="y"
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={TASK_OPTION_SHEET.dragElastic}
          dragSnapToOrigin
          onDragEnd={handleDragEnd}
          className="taskzm-option-sheet absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl"
          style={{
            height: expanded ? '100%' : TASK_OPTION_SHEET.collapsedHeight,
            transition: `height ${TASK_OPTION_SHEET.resizeMs}ms ease-out`,
          }}
        >
          <div
            className={cn('flex shrink-0 cursor-grab touch-none flex-col px-4 pb-2 pt-2 active:cursor-grabbing', TASK_DIALOG_COLORS.optionSheetHeader)}
            onPointerDown={(event) => dragControls.start(event)}
          >
            <button
              type="button"
              aria-label={expanded ? TASK_DIALOG_OPTION_SHEET_TEXT.collapse : TASK_DIALOG_OPTION_SHEET_TEXT.expand}
              onClick={() => setExpanded((value) => !value)}
              className="mx-auto mb-2 rounded-full bg-muted-foreground/30"
              style={{ width: TASK_OPTION_SHEET.handleWidthPx, height: TASK_OPTION_SHEET.handleHeightPx }}
            />
            <div className="flex items-center gap-2">
              <Icon name={option.iconName} size={ICON_SIZE_SM} className="text-primary" aria-hidden />
              <h3 className="m-0 flex-1 text-base font-semibold">{option.title}</h3>
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-label={expanded ? TASK_DIALOG_OPTION_SHEET_TEXT.collapse : TASK_DIALOG_OPTION_SHEET_TEXT.expand}
                className="flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                style={{ width: CLOSE_BUTTON.size, height: CLOSE_BUTTON.size }}
              >
                <Icon name={expanded ? 'corners-in' : 'corners-out'} size={CLOSE_BUTTON.iconPx} aria-hidden />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={TASK_DIALOG_OPTION_SHEET_TEXT.close}
                className="flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                style={{ width: CLOSE_BUTTON.size, height: CLOSE_BUTTON.size }}
              >
                <Icon name="x" size={CLOSE_BUTTON.iconPx} aria-hidden />
              </button>
            </div>
          </div>
          <div className="taskzm-option-sheet-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">{children}</div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
