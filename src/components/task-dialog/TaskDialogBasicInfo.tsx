import React from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { RichTextEditor } from "../RichTextEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
// Icons migrated to Icon component
import { Icon } from "../Icon";
import { ICON_SIZE_SM } from "../../lib/layout-constants";
import { UI_FOLDER_COLORS } from "../../lib/ui-colors";
import { Z_INDEX } from "../../lib/layout-constants";
import { TASK_DIALOG_UI_TEXT } from "../../lib/task-dialog-constants";
import type { TaskStatus, TaskPriority, Folder as FolderType } from "../../types";

interface TaskDialogBasicInfoProps {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  status: TaskStatus;
  onStatusChange: (value: TaskStatus) => void;
  priority: TaskPriority;
  onPriorityChange: (value: TaskPriority) => void;
  folderId: string | null;
  onFolderChange: (value: string | null) => void;
  folders: FolderType[];
  onFolderTagSync?: (folderId: string | null, previousFolderId: string | null, tags: string[], onTagsChange: (tags: string[]) => void) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export const TaskDialogBasicInfo = React.memo(function TaskDialogBasicInfo({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  folderId,
  onFolderChange,
  folders,
  onFolderTagSync,
  tags,
  onTagsChange,
}: TaskDialogBasicInfoProps) {
  const handleFolderChange = (value: string) => {
    const newFolderId = value === "none" ? null : value;
    const previousFolderId = folderId;
    onFolderChange(newFolderId);
    
    // Sync folder name with tags if callback provided
    if (onFolderTagSync) {
      onFolderTagSync(newFolderId, previousFolderId, tags, onTagsChange);
    }
  };

  return (
    <div className="space-y-4 bg-white/60 dark:bg-card/40 rounded-lg p-4 sm:p-5 md:p-6 border border-primary/10">
      <div className="space-y-2">
        <Label htmlFor="title" className="text-sm font-semibold">
          Title *
        </Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={TASK_DIALOG_UI_TEXT.taskTitlePlaceholder}
          autoFocus
          className="bg-white dark:bg-card/80 border-primary/20 focus:border-primary focus:ring-primary/20 h-10 sm:h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-semibold">
          Description
        </Label>
        <RichTextEditor
          value={description}
          onChange={onDescriptionChange}
          placeholder={TASK_DIALOG_UI_TEXT.descriptionPlaceholderShort}
          rows={3}
          className="focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status" className="text-sm font-semibold">
            Status
          </Label>
          <Select value={status} onValueChange={(value) => onStatusChange(value as TaskStatus)}>
            <SelectTrigger className="bg-white dark:bg-card/80 border-primary/20 focus:border-primary focus:ring-primary/20 h-10 sm:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="on-hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority" className="text-sm font-semibold">
            Priority
          </Label>
          <Select value={priority} onValueChange={(value) => onPriorityChange(value as TaskPriority)}>
            <SelectTrigger className="bg-white dark:bg-card/80 border-primary/20 focus:border-primary focus:ring-primary/20 h-10 sm:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Folder Selector */}
      {folders.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="folder" className="text-sm font-semibold flex items-center gap-2">
            <Icon name="folder" size={ICON_SIZE_SM} className="text-primary" />
            Folder
          </Label>
          <Select value={folderId || "none"} onValueChange={handleFolderChange}>
            <SelectTrigger className="bg-white dark:bg-card/80 border-primary/20 focus:border-primary focus:ring-primary/20 h-10 sm:h-11">
              <SelectValue placeholder={TASK_DIALOG_UI_TEXT.noFolder} />
            </SelectTrigger>
            <SelectContent style={{ zIndex: Z_INDEX.SELECT_CONTENT }}>
              <SelectItem value="none">{TASK_DIALOG_UI_TEXT.noFolder}</SelectItem>
              {folders
                .filter((folder) => folder && folder.id && folder.name)
                .map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: folder.color || UI_FOLDER_COLORS.fallback }}
                      />
                      <span>{folder.name}</span>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
});

