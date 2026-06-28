import { APP_TOUR_DEMO_UI } from '../lib/app-tour-constants';

/** Shown inside AI scheduler / re-scheduler dialogs during the app tour. */
export function TourDemoDialogNotice() {
  return (
    <p
      className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2"
      role="note"
    >
      {APP_TOUR_DEMO_UI.dialogNotice}
    </p>
  );
}
