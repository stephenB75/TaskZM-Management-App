import React from 'react';
import { Separator } from '../ui/separator';
import { SETTINGS_PANEL_SEPARATOR_MARGIN_Y } from '../../lib/layout-constants';

/** Consistent spacing around section dividers. */
export function SettingsDivider() {
  return (
    <Separator
      style={{
        marginTop: SETTINGS_PANEL_SEPARATOR_MARGIN_Y,
        marginBottom: SETTINGS_PANEL_SEPARATOR_MARGIN_Y,
      }}
    />
  );
}
