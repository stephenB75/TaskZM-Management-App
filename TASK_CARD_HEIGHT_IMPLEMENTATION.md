# Task Card Height Implementation

## Standard Height Guidelines

### Base Height
- **All tasks start with 80px base height** (regardless of duration)
- This base includes:
  - Top padding (4-6px)
  - Badge row (~20-24px)
  - Title row (~20-40px for 1-2 lines with line-clamp-2)
  - Bottom padding (4-6px)

### Auto-Adjustment Components

Height is automatically added for the following components:

1. **Badge Wrapping**: +24px if badges wrap to second line
2. **Description**: Calculated based on length
   - Minimum: 64px (4 lines)
   - Formula: `Math.max(estimatedLines * 16px, 64px) + bottomPadding`
   - Bottom padding: 0px if assigned users follow, 6px otherwise
3. **Assigned Users**: +20px base + spacing (16px or 20px)
4. **Pomodoro Timer**: +40px if shown absolutely (not inline)
5. **Tracking Badge**: +24px if shown at bottom (tasks >= 45 mins)
6. **Tracked Time**: +24px if shown at bottom (not at top)
7. **Subtasks**: +14px per subtask + spacing (2-4px between)

### Height Bounds
- **Minimum**: 80px
- **Maximum**: 550px

### Implementation Files
- `src/components/DraggableTaskCard.tsx` - Kanban week view
- `src/components/DraggableTodayAgendaTask.tsx` - Today agenda timeline (with 1.247x multiplier)
- `src/components/TodayAgendaView.tsx` - Height calculation function
- `src/contexts/DragDropContext.tsx` - Drag and drop positioning

## Calculation Formula

```
baseHeight = 80px (standard base)
+ badgeWrapHeight (if badges wrap)
+ descriptionHeight (if description exists)
+ assignedUsersHeight (if assigned users present)
+ pomodoroTimerHeight (if shown absolutely)
+ trackingBadgeHeight (if shown at bottom)
+ trackedTimeHeight (if shown at bottom)
+ subtasksHeight (if subtasks present)

finalHeight = Math.max(Math.min(baseHeight, 550px), 80px)
```

