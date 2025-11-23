import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Folder,
  FolderPlus,
  Edit2,
  Trash2,
  MoreVertical,
  Search,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
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
import { useTasks } from "../contexts/TaskContext";
import { useTheme } from "../contexts/ThemeContext";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { logger } from "../lib/logger";
import { FolderView } from "./FolderView";
import type { Folder as FolderType } from "../types";
import {
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_MINT_DARK,
  COLOR_PASTEL_SKY_DARK,
  COLOR_FOLDER_DEFAULT,
  FOLDER_COLOR_OPTIONS,
  getColorWithOpacity,
} from "../lib/color-theme";
import {
  FOLDER_PANEL_MOBILE_HEADER_SPACER,
  FOLDER_PANEL_SEARCH_PADDING_TOP,
  FOLDER_PANEL_SEARCH_PADDING_BOTTOM,
  FOLDER_PANEL_CONTENT_PADDING_TOP,
  FOLDER_PANEL_EMPTY_STATE_PADDING_Y,
  FOLDER_PANEL_EMPTY_STATE_ICON_SIZE,
  FOLDER_PANEL_EMPTY_STATE_ICON_MARGIN_BOTTOM,
  FOLDER_PANEL_CARD_HEADER_PADDING_BOTTOM,
  FOLDER_PANEL_CARD_HEADER_PADDING_TOP,
  FOLDER_PANEL_CARD_HEADER_PADDING_LEFT,
  FOLDER_PANEL_CARD_CONTENT_PADDING_BOTTOM,
  FOLDER_PANEL_CARD_CONTENT_PADDING_LEFT,
  FOLDER_PANEL_FOLDER_ICON_SIZE,
  FOLDER_PANEL_FOLDER_ICON_INNER_SIZE,
  FOLDER_PANEL_BUTTON_SIZE,
  FOLDER_PANEL_BUTTON_SIZE_SMALL,
  FOLDER_PANEL_DROPDOWN_WIDTH,
  FOLDER_PANEL_DROPDOWN_Z_INDEX,
  FOLDER_PANEL_COLOR_PICKER_SIZE,
  FOLDER_PANEL_SEARCH_ICON_LEFT,
  FOLDER_PANEL_SEARCH_INPUT_PADDING_LEFT,
  FOLDER_PANEL_SEARCH_CLEAR_BUTTON_RIGHT,
  FOLDER_PANEL_CARD_TITLE_MARGIN_BOTTOM,
  FOLDER_PANEL_BADGE_PADDING_X,
  FOLDER_PANEL_BADGE_PADDING_Y,
  FOLDER_PANEL_BADGE_TEXT_SIZE,
  FOLDER_PANEL_TEXT_SIZE_MEDIUM,
  FOLDER_PANEL_ICON_SIZE_SMALL,
  FOLDER_PANEL_ICON_MARGIN_RIGHT,
  FOLDER_PANEL_DIALOG_MAX_WIDTH,
  FOLDER_PANEL_DIALOG_CONTENT_SPACING,
  FOLDER_PANEL_DIALOG_FIELD_SPACING,
  FOLDER_PANEL_DIALOG_PADDING_Y,
  FOLDER_PANEL_COLOR_PICKER_GAP,
  PANEL_DROPDOWN_TIMEOUT_DELAY_MS,
  PANEL_CONTENT_SPACING,
  PANEL_PADDING,
  PANEL_GAP_LARGE,
  PANEL_GAP_MEDIUM,
  PANEL_EMPTY_STATE_TEXT_SIZE,
} from "../lib/layout-constants";

interface FoldersPanelProps {
  onFolderSelect?: (folder: FolderType) => void;
}

export function FoldersPanel({ onFolderSelect }: FoldersPanelProps) {
  const { actualTheme } = useTheme();
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
    const folder = folders.find(f => f.id === folderId);
    if (!folder || !folder.name) return 0;
    return tasks.filter((task) => 
      task.tags && 
      Array.isArray(task.tags) && 
      task.tags.includes(folder.name)
    ).length;
  };

  const getFolderProjectCount = (folderId: string) => {
    return projects.filter((project) => project.folderId === folderId).length;
  };

  // Track which folders have been mounted to prevent re-animation
  const mountedFoldersRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  
  // Initialize mounted folders from current folders list (only once)
  useEffect(() => {
    if (!initializedRef.current && folders && folders.length > 0) {
      folders.forEach(folder => {
        if (folder && folder.id) {
          mountedFoldersRef.current.add(folder.id);
        }
      });
      initializedRef.current = true;
    }
  }, [folders]);

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

  // Droppable Folder Card Component
  const DroppableFolderCard = React.memo(({ 
    folder, 
    taskCount, 
    projectCount,
    onFolderClick,
    onEditFolder,
    onDeleteFolder
  }: { 
    folder: FolderType; 
    taskCount: number; 
    projectCount: number;
    onFolderClick: (folder: FolderType) => void;
    onEditFolder: (folder: FolderType) => void;
    onDeleteFolder: (folder: FolderType) => void;
  }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `folder_${folder.id}`,
    });

    // Local state to control dropdown menu
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Track initial mount per folder to avoid repeated entrance animations
    const hasMounted = mountedFoldersRef.current.has(folder.id);
    if (!hasMounted) {
      mountedFoldersRef.current.add(folder.id);
    }

    const wrapperClassName = cn(
      isOver && "ring-2 ring-primary/50 ring-inset"
    );

    return (
      <div ref={setNodeRef} className={wrapperClassName}>
        <Card 
          data-slot="card"
          className={cn(
            "relative border transition-colors duration-200",
            "bg-card",
            !dropdownOpen && "hover:border-primary/40 hover:shadow-md",
            isOver && "ring-2 ring-primary/30 bg-primary/5 border-primary/50"
          )}
        >
          {/* Left border accent */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
            style={{ backgroundColor: folder.color || COLOR_FOLDER_DEFAULT }}
          />
          
          <CardHeader 
            className="flex-shrink-0"
            style={{ 
              paddingBottom: FOLDER_PANEL_CARD_HEADER_PADDING_BOTTOM,
              paddingTop: FOLDER_PANEL_CARD_HEADER_PADDING_TOP,
              paddingLeft: FOLDER_PANEL_CARD_HEADER_PADDING_LEFT
            }}
          >
            <div className="flex items-start justify-between" style={{ gap: PANEL_GAP_LARGE }}>
              <div className="flex items-start flex-1 min-w-0" style={{ gap: PANEL_GAP_LARGE }}>
                {/* Simple folder icon */}
                <div
                  className="rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ 
                    width: FOLDER_PANEL_FOLDER_ICON_SIZE,
                    height: FOLDER_PANEL_FOLDER_ICON_SIZE,
                    backgroundColor: getColorWithOpacity(folder.color || COLOR_FOLDER_DEFAULT, 0.08),
                  }}
                >
                  <Folder
                    style={{ 
                      width: FOLDER_PANEL_FOLDER_ICON_INNER_SIZE,
                      height: FOLDER_PANEL_FOLDER_ICON_INNER_SIZE,
                      color: folder.color || COLOR_FOLDER_DEFAULT
                    }}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <CardTitle 
                    className="font-semibold"
                    style={{ 
                      fontSize: FOLDER_PANEL_TEXT_SIZE_MEDIUM,
                      marginBottom: FOLDER_PANEL_CARD_TITLE_MARGIN_BOTTOM
                    }}
                  >
                    {folder.name || "Unnamed Folder"}
                  </CardTitle>
                  {folder.description && (
                    <CardDescription 
                      className="line-clamp-1"
                      style={{ fontSize: FOLDER_PANEL_BADGE_TEXT_SIZE }}
                    >
                      {folder.description}
                    </CardDescription>
                  )}
                </div>
              </div>
              
              {/* Dropdown menu */}
              <div 
                className="relative"
                style={{ zIndex: FOLDER_PANEL_DROPDOWN_Z_INDEX }}
                onClick={(e) => {
                  e.stopPropagation();
                }} 
              >
                <DropdownMenu
                  open={dropdownOpen}
                  onOpenChange={setDropdownOpen}
                  modal={false}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 hover:bg-transparent hover:text-current"
                      style={{ 
                        height: FOLDER_PANEL_BUTTON_SIZE,
                        width: FOLDER_PANEL_BUTTON_SIZE
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      aria-label="Folder options"
                    >
                      <MoreVertical style={{ width: FOLDER_PANEL_ICON_SIZE_SMALL, height: FOLDER_PANEL_ICON_SIZE_SMALL }} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end"
                    style={{ 
                      zIndex: FOLDER_PANEL_DROPDOWN_Z_INDEX,
                      width: FOLDER_PANEL_DROPDOWN_WIDTH
                    }}
                    onCloseAutoFocus={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onFolderClick(folder);
                        }, PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                      }}
                      className="cursor-pointer"
                    >
                      <Folder style={{ width: FOLDER_PANEL_ICON_SIZE_SMALL, height: FOLDER_PANEL_ICON_SIZE_SMALL, marginRight: FOLDER_PANEL_ICON_MARGIN_RIGHT }} />
                      Open Folder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onEditFolder(folder);
                        }, PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                      }}
                      className="cursor-pointer"
                    >
                      <Edit2 style={{ width: FOLDER_PANEL_ICON_SIZE_SMALL, height: FOLDER_PANEL_ICON_SIZE_SMALL, marginRight: FOLDER_PANEL_ICON_MARGIN_RIGHT }} />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onDeleteFolder(folder);
                        }, PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                      }}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <Trash2 style={{ width: FOLDER_PANEL_ICON_SIZE_SMALL, height: FOLDER_PANEL_ICON_SIZE_SMALL, marginRight: FOLDER_PANEL_ICON_MARGIN_RIGHT }} />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          
          <CardContent 
            style={{ 
              paddingTop: 0,
              paddingBottom: FOLDER_PANEL_CARD_CONTENT_PADDING_BOTTOM,
              paddingLeft: FOLDER_PANEL_CARD_CONTENT_PADDING_LEFT
            }}
          >
            <div className="flex items-center justify-between" style={{ gap: PANEL_GAP_MEDIUM }}>
              {/* Stats */}
              <div className="flex items-center" style={{ gap: PANEL_GAP_MEDIUM }}>
                <Badge 
                  variant="secondary" 
                  style={{ 
                    fontSize: FOLDER_PANEL_BADGE_TEXT_SIZE,
                    paddingLeft: FOLDER_PANEL_BADGE_PADDING_X,
                    paddingRight: FOLDER_PANEL_BADGE_PADDING_X,
                    paddingTop: FOLDER_PANEL_BADGE_PADDING_Y,
                    paddingBottom: FOLDER_PANEL_BADGE_PADDING_Y
                  }}
                >
                  {taskCount} {taskCount === 1 ? "task" : "tasks"}
                </Badge>
                <Badge 
                  variant="secondary" 
                  style={{ 
                    fontSize: FOLDER_PANEL_BADGE_TEXT_SIZE,
                    paddingLeft: FOLDER_PANEL_BADGE_PADDING_X,
                    paddingRight: FOLDER_PANEL_BADGE_PADDING_X,
                    paddingTop: FOLDER_PANEL_BADGE_PADDING_Y,
                    paddingBottom: FOLDER_PANEL_BADGE_PADDING_Y
                  }}
                >
                  {projectCount} {projectCount === 1 ? "project" : "projects"}
                </Badge>
              </div>
              
              {/* Open button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="flex-shrink-0 hover:bg-transparent hover:text-current"
                style={{ 
                  height: FOLDER_PANEL_BUTTON_SIZE,
                  width: FOLDER_PANEL_BUTTON_SIZE
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFolderClick(folder);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label="Open folder"
              >
                <ChevronRight style={{ width: FOLDER_PANEL_ICON_SIZE_SMALL, height: FOLDER_PANEL_ICON_SIZE_SMALL }} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.folder.id === nextProps.folder.id &&
      prevProps.folder.name === nextProps.folder.name &&
      prevProps.folder.description === nextProps.folder.description &&
      prevProps.folder.color === nextProps.folder.color &&
      prevProps.taskCount === nextProps.taskCount &&
      prevProps.projectCount === nextProps.projectCount &&
      prevProps.onFolderClick === nextProps.onFolderClick &&
      prevProps.onEditFolder === nextProps.onEditFolder &&
      prevProps.onDeleteFolder === nextProps.onDeleteFolder
    );
  });
  
  DroppableFolderCard.displayName = 'DroppableFolderCard';

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

  // Get appropriate colors based on theme
  const isDark = actualTheme === 'dark';
  // Use dark mode colors from CSS variables (matching globals.css)
  const gradientColor1 = isDark ? '#8A7A9A' : COLOR_PASTEL_LAVENDER; // pastel-lavender dark variant
  const gradientColor2 = isDark ? COLOR_PASTEL_SKY_DARK : COLOR_PASTEL_SKY;
  const gradientColor3 = isDark ? COLOR_PASTEL_MINT_DARK : COLOR_PASTEL_MINT;

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: `linear-gradient(to bottom, ${getColorWithOpacity(gradientColor1, 0.35)}, ${getColorWithOpacity(gradientColor2, 0.35)}, ${getColorWithOpacity(gradientColor3, 0.35)})`,
      }}
    >
      {/* Header */}
      <AppHeader
        title="Folders"
        panelOpen={true}
        isSidePanelHeader={true}
        description={`${filteredFolders.length} of ${folders?.length || 0} folder${(folders?.length || 0) === 1 ? "" : "s"}`}
        actions={
          <Button
            onClick={() => {
              setEditingFolder(null);
              setNewFolderName("");
              setNewFolderDescription("");
              setNewFolderColor(COLOR_FOLDER_DEFAULT);
              setShowAddFolder(true);
            }}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            size="sm"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add Folder</span>
            <span className="sm:hidden">Add</span>
          </Button>
        }
        hideDesktopLogo
      />
      {/* Spacer for fixed header on mobile */}
      <div className="lg:hidden" style={{ height: FOLDER_PANEL_MOBILE_HEADER_SPACER }} />

      {/* Search Bar */}
      <div 
        className="border-b border-primary/10"
        style={{ 
          paddingLeft: PANEL_PADDING,
          paddingRight: PANEL_PADDING,
          paddingTop: FOLDER_PANEL_SEARCH_PADDING_TOP,
          paddingBottom: FOLDER_PANEL_SEARCH_PADDING_BOTTOM
        }}
      >
        <div className="relative">
          <Search 
            className="absolute top-1/2 -translate-y-1/2 text-muted-foreground" 
            style={{ 
              left: FOLDER_PANEL_SEARCH_ICON_LEFT,
              width: FOLDER_PANEL_ICON_SIZE_SMALL,
              height: FOLDER_PANEL_ICON_SIZE_SMALL
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
              <X style={{ width: FOLDER_PANEL_ICON_SIZE_SMALL, height: FOLDER_PANEL_ICON_SIZE_SMALL }} />
            </Button>
          )}
        </div>
      </div>

      {/* Folders List */}
      <ScrollArea className="flex-1">
        <div 
          className="pb-safe md:pb-4" 
          style={{ 
            padding: PANEL_PADDING,
            paddingTop: FOLDER_PANEL_CONTENT_PADDING_TOP,
            paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))',
            gap: PANEL_CONTENT_SPACING
          }}
        >
          {filteredFolders.length === 0 ? (
            <div 
              className="text-center" 
              style={{ 
                paddingTop: FOLDER_PANEL_EMPTY_STATE_PADDING_Y,
                paddingBottom: FOLDER_PANEL_EMPTY_STATE_PADDING_Y
              }}
            >
              <Folder 
                className="mx-auto text-muted-foreground opacity-50" 
                style={{ 
                  width: FOLDER_PANEL_EMPTY_STATE_ICON_SIZE,
                  height: FOLDER_PANEL_EMPTY_STATE_ICON_SIZE,
                  marginBottom: FOLDER_PANEL_EMPTY_STATE_ICON_MARGIN_BOTTOM
                }} 
              />
              <p 
                className="text-muted-foreground"
                style={{ fontSize: PANEL_EMPTY_STATE_TEXT_SIZE }}
              >
                {searchQuery
                  ? "No folders match your search"
                  : "No folders yet"}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setShowAddFolder(true)}
                  size="sm"
                  style={{ marginTop: PANEL_PADDING }}
                >
                  <FolderPlus style={{ width: FOLDER_PANEL_ICON_SIZE_SMALL, height: FOLDER_PANEL_ICON_SIZE_SMALL, marginRight: FOLDER_PANEL_ICON_MARGIN_RIGHT }} />
                  Create Your First Folder
                </Button>
              )}
            </div>
          ) : (
            filteredFolders.map((folder) => {
              const taskCount = getFolderTaskCount(folder.id);
              const projectCount = getFolderProjectCount(folder.id);

              return (
                <DroppableFolderCard 
                  key={folder.id} 
                  folder={folder} 
                  taskCount={taskCount} 
                  projectCount={projectCount}
                  onFolderClick={handleFolderClick}
                  onEditFolder={handleEditFolder}
                  onDeleteFolder={handleDeleteFolderClick}
                />
              );
            })
          )}
        </div>
      </ScrollArea>

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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

