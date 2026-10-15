import React from 'react';
import { PLANNER_LAYOUT } from '../../lib/layout-constants';
import { PlannerTimeline } from './PlannerTimeline';
import { PlannerCalendar } from './PlannerCalendar';
import { PlannerChat } from './PlannerChat';

/** Desktop planner: timeline, calendar, and AI chat side by side. */
export function PlannerDesktop() {
  return (
    <div
      className="planner-shell"
      style={{
        gridTemplateColumns: `${PLANNER_LAYOUT.timelineColumn} ${PLANNER_LAYOUT.calendarColumn} ${PLANNER_LAYOUT.chatColumn}`,
      }}
    >
      <PlannerTimeline className="planner-timeline-col" />
      <PlannerCalendar />
      <PlannerChat />
    </div>
  );
}
