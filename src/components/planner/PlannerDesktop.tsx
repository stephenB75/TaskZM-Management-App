import React from 'react';
import { PLANNER_LAYOUT } from '../../lib/layout-constants';
import { PlannerTimeline } from './PlannerTimeline';
import { PlannerCalendar } from './PlannerCalendar';
import { PlannerChat } from './PlannerChat';

/** Desktop planner: week shows timeline, calendar, and scheduler chat; month gives the calendar the full width. */
export function PlannerDesktop({ mode }: { mode: 'week' | 'month' }) {
  if (mode === 'month') {
    return (
      <div className="planner-shell" data-mode="month" style={{ gridTemplateColumns: PLANNER_LAYOUT.calendarColumn }}>
        <PlannerCalendar mode="month" />
      </div>
    );
  }
  return (
    <div
      className="planner-shell"
      style={{
        gridTemplateColumns: `${PLANNER_LAYOUT.timelineColumn} ${PLANNER_LAYOUT.calendarColumn} ${PLANNER_LAYOUT.chatColumn}`,
      }}
    >
      <PlannerTimeline className="planner-timeline-col" showBrand />
      <PlannerCalendar mode="week" />
      <PlannerChat />
    </div>
  );
}
