import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { Icon } from './Icon';
import { useTasks } from '../contexts/TaskContext';
import { usePermissions } from '../hooks/usePermissions';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../lib/native-haptics';
import {
  ICON_SIZE_SM,
  MOBILE_HOME_CARD_PADDING,
  MOBILE_HOME_CARD_RADIUS,
  MOBILE_HOME_TAB_FONT_SIZE,
  SWIPE_COMPLETE_ELASTIC,
  SWIPE_COMPLETE_THRESHOLD_PX,
  SWIPE_TAP_SLOP_PX,
} from '../lib/layout-constants';
import { MOBILE_HOME_UI_TEXT } from '../lib/navigation-constants';
import type { Task } from '../types';

interface SwipeToCompleteProps {
  task: Task;
  children: React.ReactNode;
}

/** Phone task card wrapper: swipe right to mark the task done. */
export function SwipeToComplete({ task, children }: SwipeToCompleteProps) {
  const { updateTask } = useTasks();
  const { canEditTask } = usePermissions();
  const x = useMotionValue(0);
  const revealOpacity = useTransform(x, [0, SWIPE_COMPLETE_THRESHOLD_PX], [0, 1]);
  const draggedRef = useRef(false);
  const armedRef = useRef(false);

  if (task.status === 'done' || !canEditTask) return <>{children}</>;

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SWIPE_TAP_SLOP_PX) draggedRef.current = true;
    const armed = info.offset.x >= SWIPE_COMPLETE_THRESHOLD_PX;
    if (armed !== armedRef.current) {
      armedRef.current = armed;
      if (armed) void triggerSelectionHaptic();
    }
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    armedRef.current = false;
    if (info.offset.x < SWIPE_COMPLETE_THRESHOLD_PX) return;
    void triggerSuccessHaptic();
    void updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() });
  };

  return (
    <div className="relative overflow-hidden" style={{ borderRadius: MOBILE_HOME_CARD_RADIUS }}>
      <motion.div
        aria-hidden
        className="absolute inset-y-0 left-0 flex items-center overflow-hidden whitespace-nowrap bg-primary/15 text-primary font-medium"
        style={{
          width: x,
          opacity: revealOpacity,
          gap: MOBILE_HOME_CARD_PADDING,
          paddingLeft: MOBILE_HOME_CARD_PADDING,
          fontSize: MOBILE_HOME_TAB_FONT_SIZE,
          borderRadius: MOBILE_HOME_CARD_RADIUS,
        }}
      >
        <Icon name="check-circle" size={ICON_SIZE_SM} weight="fill" />
        {MOBILE_HOME_UI_TEXT.actionDone}
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragSnapToOrigin
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: SWIPE_COMPLETE_ELASTIC }}
        onDragStart={() => {
          draggedRef.current = false;
        }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClickCapture={(event) => {
          if (!draggedRef.current) return;
          draggedRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        className="relative"
        style={{ x, touchAction: 'pan-y', borderRadius: MOBILE_HOME_CARD_RADIUS }}
      >
        {children}
      </motion.div>
    </div>
  );
}
