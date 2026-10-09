import React, { useState, useMemo, useCallback } from "react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_XL } from "../lib/layout-constants";
import { AppHeader } from "./AppHeader";
import { HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_BOTTOM_PADDING_MOBILE, VIEWPORT_BREAKPOINTS, MOBILE_PADDING_BOTTOM } from "../lib/layout-constants";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { ScrollArea } from "./ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { useTasks } from "../contexts/TaskContext";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { logger } from "../lib/logger";
import { FolderView } from "./FolderView";
import { FolderCard } from "./FolderCard";
import type { Folder as FolderType } from "../types";
import {
  COLOR_FOLDER_DEFAULT,
  FOLDER_COLOR_OPTIONS,
} from "../lib/color-theme";
import { FOLDER_CARD } from "../lib/folder-constants";
import {
  FOLDER_PANEL_SEARCH_PADDING_TOP,
  FOLDER_PANEL_SEARCH_PADDING_BOTTOM,
  FOLDER_PANEL_CONTENT_PADDING_TOP,
  FOLDER_PANEL_EMPTY_STATE_PADDING_Y,
  FOLDER_PANEL_EMPTY_STATE_ICON_SIZE,
  FOLDER_PANEL_EMPTY_STATE_ICON_MARGIN_BOTTOM,
  FOLDER_PANEL_BUTTON_SIZE_SMALL,
  FOLDER_PANEL_COLOR_PICKER_SIZE,
  FOLDER_PANEL_SEARCH_ICON_LEFT,
  FOLDER_PANEL_SEARCH_INPUT_PADDING_LEFT,
  FOLDER_PANEL_SEARCH_CLEAR_BUTTON_RIGHT,
  FOLDER_PANEL_ICON_SIZE_SMALL,
  FOLDER_PANEL_DIALOG_MAX_WIDTH,
  ICON_SIZE_MD,
  FOLDER_PANEL_DIALOG_CONTENT_SPACING,
  FOLDER_PANEL_DIALOG_FIELD_SPACING,
  FOLDER_PANEL_DIALOG_PADDING_Y,
  FOLDER_PANEL_COLOR_PICKER_GAP,
  PANEL_PADDING,
  PANEL_EMPTY_STATE_TEXT_SIZE,
} from "../lib/layout-constants";

interface FoldersPanelProps {
  onFolderSelect?: (folder: FolderType) => void;
}

export function FoldersPanel({ onFolderSelect }: FoldersPanelProps) {
  const {
    folders,
    addFolder,
    updateFolder,
    deleteFolder,
    tasks,
    projects,
  } = useTasks();
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(COLOR_FOLDER_DEFAULT);
  const [searchQuery, setSearchQuery] = useState("");
  const [folderToDelete, setFolderToDelete] = useState<FolderType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const query = searchQuery.toLowerCase();
    return folders.filter(
      (folder) =>
        folder.name?.toLowerCase().includes(query) ||
        (folder.description && folder.description.toLowerCase().includes(query))
    );
  }, [folders, searchQuery]);

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name is required");
      return;
    }

    try {
      await addFolder({
        name: newFolderName.trim(),
        description: newFolderDescription.trim(),
        color: newFolderColor,
      });
      setNewFolderName("");
      setNewFolderDescription("");
      setNewFolderColor(COLOR_FOLDER_DEFAULT);
      setShowAddFolder(false);
    } catch (error) {
      logger.error("Error adding folder:", error);
      toast.error("Failed to create folder");
    }
  };

  const handleEditFolder = useCallback((folder: FolderType) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name || "");
    setNewFolderDescription(folder.description || "");
    setNewFolderColor(folder.color || COLOR_FOLDER_DEFAULT);
    setShowAddFolder(true);
  }, []);

  const handleUpdateFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) {
      toast.error("Folder name is required");
      return;
    }

    try {
      await updateFolder(editingFolder.id, {
        name: newFolderName.trim(),
        description: newFolderDescription.trim(),
        color: newFolderColor,
      });
      setEditingFolder(null);
      setNewFolderName("");
      setNewFolderDescription("");
      setNewFolderColor(COLOR_FOLDER_DEFAULT);
      setShowAddFolder(false);
    } catch (error) {
      logger.error("Error updating folder:", error);
      toast.error("Failed to update folder");
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;

    setIsDeleting(true);
    try {
      await deleteFolder(folderToDelete.id);
      // Success - close dialog
      setFolderToDelete(null);
    } catch (error) {
      logger.error("Error deleting folder:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Error toast is already shown by deleteFolder, but we can add more context if needed
      if (!errorMessage.includes('Workspace not found') && !errorMessage.includes('Folder deletion failed')) {
        toast.error("Failed to delete folder. Please try again.");
      }
      // Don't close dialog on error so user can try again or cancel
    } finally {
      setIsDeleting(false);
    }
  };

  const getFolderTaskCount = (folderId: string) => {
    // Count tasks by folder name in tags (primary method)
    if (!Array.isArray(folders) || !Array.isArray(tasks)) return 0;
    const folder = folders.find(f => f && f.id === folderId);
    if (!folder || !folder.name) return 0;
    return tasks.filter((task) => 
      task && 
      task.tags && 
      Array.isArray(task.tags) && 
      task.tags.includes(folder.name)
    ).length;
  };

  const getFolderProjectCount = (folderId: string) => {
    if (!Array.isArray(projects)) return 0;
    return projects.filter((project) => project && project.folderId === folderId).length;
  };

  const handleFolderClick = useCallback((folder: FolderType) => {
    if (onFolderSelect) {
      onFolderSelect(folder);
    } else {
      setSelectedFolder(folder);
    }
  }, [onFolderSelect]);

  const handleDeleteFolderClick = useCallback((folder: FolderType) => {
    setFolderToDelete(folder);
  }, []);

  const renderFolderList = () => {
    if (filteredFolders.length === 0) {
      return (
        <div
          className="text-center"
          style={{
            paddingTop: FOLDER_PANEL_EMPTY_STATE_PADDING_Y,
            paddingBottom: FOLDER_PANEL_EMPTY_STATE_PADDING_Y,
          }}
        >
          <Icon
            name="folder"
            size={FOLDER_PANEL_EMPTY_STATE_ICON_SIZE}
            className="mx-auto text-primary/50"
            style={{
              marginBottom: FOLDER_PANEL_EMPTY_STATE_ICON_MARGIN_BOTTOM,
            }}
          />
          <p
            className="text-muted-foreground dark:text-muted-foreground"
            style={{ fontSize: PANEL_EMPTY_STATE_TEXT_SIZE }}
          >
            {searchQuery ? "No folders match your search" : "No folders yet"}
          </p>
        </div>
      );
    }

    return (
      <div
        className="flex flex-col"
        style={{ gap: FOLDER_CARD.listGapPx }}
      >
        {filteredFolders.map((folder) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            taskCount={getFolderTaskCount(folder.id)}
            projectCount={getFolderProjectCount(folder.id)}
            onFolderClick={handleFolderClick}
            onEditFolder={handleEditFolder}
            onDeleteFolder={handleDeleteFolderClick}
          />
        ))}
      </div>
    );
  };

  // Use color options from constants
  const colorOptions = FOLDER_COLOR_OPTIONS;

  // If a folder is selected, show folder view
  if (selectedFolder) {
    return (
      <FolderView
        folder={selectedFolder}
        onBack={() => setSelectedFolder(null)}
      />
    );
  }

  return (
    <div
      className={cn("flex flex-col bg-white dark:bg-gray-950", typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.mobile ? 'min-h-full' : 'h-full')}
    >
      {/* Header */}
      <AppHeader
        title="Folders"
        panelOpen={true}
        isSidePanelHeader={true}
        description={`${filteredFolders.length} of ${folders?.length || 0} folder${(folders?.length || 0) === 1 ? "" : "s"}`}
        actions={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  onClick={() => {
                    setEditingFolder(null);
                    setNewFolderName("");
                    setNewFolderDescription("");
                    setNewFolderColor(COLOR_FOLDER_DEFAULT);
                    setShowAddFolder(true);
                  }}
                  className="cursor-pointer flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setEditingFolder(null);
                      setNewFolderName("");
                      setNewFolderDescription("");
                      setNewFolderColor(COLOR_FOLDER_DEFAULT);
                      setShowAddFolder(true);
                    }
                  }}
                >
                  <Icon 
                    name="folder-simple-plus"
                    size={ICON_SIZE_XL}
                    className="text-primary dark:text-primary-foreground flex-shrink-0"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Folder</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
        hideDesktopLogo
      />

      {/* Search Bar */}
      <div 
        className="border-b border-primary/20 bg-muted/40 dark:bg-card/60"
        style={{ 
          paddingLeft: PANEL_PADDING,
          paddingRight: PANEL_PADDING,
          paddingTop: FOLDER_PANEL_SEARCH_PADDING_TOP,
          paddingBottom: FOLDER_PANEL_SEARCH_PADDING_BOTTOM
        }}
      >
        <div className="relative">
          <Icon 
            name="search"
            size={FOLDER_PANEL_ICON_SIZE_SMALL}
            className="absolute top-1/2 -translate-y-1/2 text-primary/70" 
            style={{ 
              left: FOLDER_PANEL_SEARCH_ICON_LEFT
            }} 
          />
          <Input
            placeholder="Search folders by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: FOLDER_PANEL_SEARCH_INPUT_PADDING_LEFT }}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 -translate-y-1/2"
              style={{ 
                right: FOLDER_PANEL_SEARCH_CLEAR_BUTTON_RIGHT,
                height: FOLDER_PANEL_BUTTON_SIZE_SMALL,
                width: FOLDER_PANEL_BUTTON_SIZE_SMALL
              }}
              onClick={() => setSearchQuery("")}
            >
              <Icon name="x" size={FOLDER_PANEL_ICON_SIZE_SMALL} />
            </Button>
          )}
        </div>
      </div>

      {/* Folders List */}
      {/* On mobile, rely on parent scroll container in App.tsx - no ScrollArea */}
      <div className="flex-1 min-h-0">
        {typeof window !== 'undefined' && window.innerWidth >= VIEWPORT_BREAKPOINTS.mobile ? (
        <ScrollArea className="h-full">
        <div 
          className="pb-safe md:pb-4" 
          style={{ 
            padding: PANEL_PADDING,
            paddingTop: FOLDER_PANEL_CONTENT_PADDING_TOP,
            paddingBottom: NAV_BAR_BOTTOM_PADDING_MOBILE,
          }}
        >
          {renderFolderList()}
        </div>
      </ScrollArea>
        ) : (
          <div className="h-full">
            <div 
              className="pb-safe md:pb-4" 
              style={{ 
                padding: PANEL_PADDING,
                paddingTop: FOLDER_PANEL_CONTENT_PADDING_TOP,
                paddingBottom: typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.tablet ? MOBILE_PADDING_BOTTOM : undefined,
              }}
            >
              {renderFolderList()}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Folder Dialog */}
      <Dialog open={showAddFolder} onOpenChange={setShowAddFolder}>
        <DialogContent style={{ maxWidth: FOLDER_PANEL_DIALOG_MAX_WIDTH }}>
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? "Edit Folder" : "Create New Folder"}
            </DialogTitle>
            <DialogDescription>
              {editingFolder
                ? "Update folder details below."
                : "Organize your tasks and projects into folders."}
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: FOLDER_PANEL_DIALOG_CONTENT_SPACING, paddingTop: FOLDER_PANEL_DIALOG_PADDING_Y, paddingBottom: FOLDER_PANEL_DIALOG_PADDING_Y }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: FOLDER_PANEL_DIALOG_FIELD_SPACING }}>
              <Label htmlFor="folder-name">Folder Name *</Label>
              <Input
                id="folder-name"
                placeholder="e.g., Work Projects"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    editingFolder ? handleUpdateFolder() : handleAddFolder();
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: FOLDER_PANEL_DIALOG_FIELD_SPACING }}>
              <Label htmlFor="folder-description">Description</Label>
              <Input
                id="folder-description"
                placeholder="Optional description"
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: FOLDER_PANEL_DIALOG_FIELD_SPACING }}>
              <Label>Color</Label>
              <div className="flex flex-wrap" style={{ gap: FOLDER_PANEL_COLOR_PICKER_GAP }}>
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewFolderColor(color)}
                    className={cn(
                      "rounded-full border-2 transition-all",
                      newFolderColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ 
                      width: FOLDER_PANEL_COLOR_PICKER_SIZE,
                      height: FOLDER_PANEL_COLOR_PICKER_SIZE,
                      backgroundColor: color
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddFolder(false);
                setEditingFolder(null);
                setNewFolderName("");
                setNewFolderDescription("");
                setNewFolderColor(COLOR_FOLDER_DEFAULT);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingFolder ? handleUpdateFolder : handleAddFolder}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {editingFolder ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!folderToDelete}
        onOpenChange={(open) => !open && setFolderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{folderToDelete?.name}"? This
              will remove the folder tag from all tasks that have it, but
              won't delete the tasks themselves.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Icon name="loader-2" size={ICON_SIZE_MD} className="mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

