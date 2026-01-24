import React from "react";
import { Icon } from "./Icon";
import { cn } from "../lib/utils";
import { TASK_DIALOG_UI_TEXT, TASK_DIALOG_MENU_ITEM_HEIGHT } from "../lib/task-dialog-constants";
import { ICON_SIZE_MD } from "../lib/layout-constants";

interface TaskDialogMenuProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface MenuItem {
  value: string;
  label: string;
  icon: string;
}

const menuItems: MenuItem[] = [
  {
    value: "basic",
    label: TASK_DIALOG_UI_TEXT.basicInfo.desktop,
    icon: "file-text",
  },
  {
    value: "scheduling",
    label: TASK_DIALOG_UI_TEXT.schedule.desktop,
    icon: "calendar",
  },
  {
    value: "organization",
    label: TASK_DIALOG_UI_TEXT.organize.desktop,
    icon: "settings",
  },
];

export function TaskDialogMenu({ activeTab, onTabChange }: TaskDialogMenuProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      {menuItems.map((item) => {
        const isActive = activeTab === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onTabChange(item.value)}
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all duration-200",
              "text-left font-medium text-sm",
              "border-2",
              isActive
                ? "bg-primary/10 border-primary/50 text-primary shadow-md"
                : "bg-transparent border-transparent text-foreground hover:bg-accent hover:border-primary/20 hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            )}
            style={{
              height: TASK_DIALOG_MENU_ITEM_HEIGHT.desktop,
              minHeight: TASK_DIALOG_MENU_ITEM_HEIGHT.desktop,
            }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Icon
                name={item.icon as any}
                size={ICON_SIZE_MD}
                className={cn(
                  "flex-shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                weight={isActive ? "duotone" : "regular"}
              />
              <span className="truncate">{item.label}</span>
            </div>
            <Icon
              name="chevron-right"
              size={16}
              className={cn(
                "flex-shrink-0 transition-transform duration-200",
                isActive
                  ? "text-primary rotate-90"
                  : "text-muted-foreground opacity-50"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
