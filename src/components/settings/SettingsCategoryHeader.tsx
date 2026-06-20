import React from 'react';
import {
  SETTINGS_PANEL_ACCORDION_ITEM_PADDING_X,
  SETTINGS_PANEL_CATEGORY_HEADER_FONT_SIZE,
  SETTINGS_PANEL_CATEGORY_HEADER_LETTER_SPACING_EM,
  SETTINGS_PANEL_CATEGORY_HEADER_PADDING_BOTTOM,
  SETTINGS_PANEL_CATEGORY_HEADER_PADDING_TOP,
} from '../../lib/layout-constants';

interface SettingsCategoryHeaderProps {
  title: string;
}

export function SettingsCategoryHeader({ title }: SettingsCategoryHeaderProps) {
  return (
    <div
      className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm"
      style={{
        paddingLeft: SETTINGS_PANEL_ACCORDION_ITEM_PADDING_X,
        paddingRight: SETTINGS_PANEL_ACCORDION_ITEM_PADDING_X,
        paddingTop: SETTINGS_PANEL_CATEGORY_HEADER_PADDING_TOP,
        paddingBottom: SETTINGS_PANEL_CATEGORY_HEADER_PADDING_BOTTOM,
      }}
    >
      <p
        className="font-semibold uppercase tracking-wider text-muted-foreground"
        style={{
          fontSize: SETTINGS_PANEL_CATEGORY_HEADER_FONT_SIZE,
          letterSpacing: `${SETTINGS_PANEL_CATEGORY_HEADER_LETTER_SPACING_EM}em`,
        }}
      >
        {title}
      </p>
    </div>
  );
}
