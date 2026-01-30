# Task Dialog Design Reference

This folder contains the **design reference images** for the Task Dialog component. Use these when implementing or updating `src/components/TaskDialog.tsx` so the UI matches the intended look and feel.

## Images

| File | View | Description |
|------|------|-------------|
| `task-dialog-basic.png` | **Task Info** (Basic) | Header with "Task Info" + Schedule/Organize; Task Name & Description; Status and Priority Level pills; cancel / + CREATE footer. |
| `task-dialog-schedule.png` | **Schedule** | Header with Task Info / Schedule (active) / Organize; prominent date; Scheduled / Due Date / Clear; calendar grid; 12HR/24HR toggles; Hour, Min, AM/PM. |

## Design notes (from reference)

- **Background**: Light orange-yellow / peach (`#ffeeb2`-style) for the dialog.
- **Header**: Minimal — current context (e.g. "Task Info") in muted grey; other sections (Schedule, Organize) listed below; back chevron when not on Basic.
- **Inputs**: Rounded, white background, borderless where appropriate.
- **Pills**: Status and Priority as horizontal pills; selected = purple/purple-pink with white text.
- **Footer**: Prominent actions — e.g. red "cancel", purple "+ CREATE".
- **Schedule**: Large bold date; purple for active "Scheduled"; calendar with selected date highlighted; time format toggles and time dropdowns.

These images were saved from user-provided uploads for ongoing reference. When changing the Task Dialog, compare against these files to keep the design aligned.
