import React from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Icon } from '../Icon';
import { cn } from '../../lib/utils';
import { COLOR_PRIMARY } from '../../lib/color-theme';
import {
  SETTINGS_PANEL_ACCORDION_CONTENT_SPACING,
  SETTINGS_PANEL_ACCORDION_ICON_SIZE,
  SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y,
  SETTINGS_PANEL_ICON_TILE_SIZE,
  SETTINGS_PANEL_MARGIN_TOP_XSMALL,
  SETTINGS_PANEL_SECTION_TRIGGER_PADDING_X,
  SETTINGS_PANEL_TEXT_SIZE_SMALL,
} from '../../lib/layout-constants';

interface SettingsSectionProps {
  value: string;
  icon: string;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  iconWeight?: 'regular' | 'duotone' | 'fill' | 'bold';
  className?: string;
  dataTour?: string;
  children: React.ReactNode;
}

export function SettingsSection({
  value,
  icon,
  title,
  description,
  badge,
  iconWeight = 'duotone',
  className,
  dataTour,
  children,
}: SettingsSectionProps) {
  return (
    <AccordionItem
      value={value}
      data-tour={dataTour}
      className={cn(
        'mb-2 overflow-hidden rounded-2xl border border-border/40 bg-card/95 shadow-sm last:mb-0',
        className,
      )}
    >
      <AccordionTrigger
        className="hover:no-underline px-0 [&>svg:last-child]:mr-4 [&>svg:last-child]:text-muted-foreground/70"
        style={{
          paddingTop: SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y,
          paddingBottom: SETTINGS_PANEL_ACCORDION_TRIGGER_PADDING_Y,
          paddingLeft: SETTINGS_PANEL_SECTION_TRIGGER_PADDING_X,
          paddingRight: SETTINGS_PANEL_SECTION_TRIGGER_PADDING_X,
        }}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3 pr-2 text-left">
          <div
            className="flex shrink-0 items-center justify-center rounded-xl bg-primary/10"
            style={{
              width: SETTINGS_PANEL_ICON_TILE_SIZE,
              height: SETTINGS_PANEL_ICON_TILE_SIZE,
            }}
          >
            <Icon
              name={icon}
              size={SETTINGS_PANEL_ACCORDION_ICON_SIZE}
              weight={iconWeight}
              color={COLOR_PRIMARY}
              className="flex-shrink-0"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{title}</span>
              {badge}
            </div>
            {description ? (
              <p
                className="text-muted-foreground"
                style={{
                  fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL,
                  marginTop: SETTINGS_PANEL_MARGIN_TOP_XSMALL,
                  lineHeight: 1.45,
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-0 pt-0">
        <div
          className="px-4 pb-4"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SETTINGS_PANEL_ACCORDION_CONTENT_SPACING,
          }}
        >
          {children}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
