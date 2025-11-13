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
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { logger } from "../lib/logger";
import { FolderView } from "./FolderView";
import type { Folder as FolderType } from "../types";

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
  const [newFolderColor, setNewFolderColor] = useState("#3b82f6");
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
      setNewFolderColor("#3b82f6");
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
    setNewFolderColor(folder.color || "#3b82f6");
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
      setNewFolderColor("#3b82f6");
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
      setFolderToDelete(null);
    } catch (error) {
      logger.error("Error deleting folder:", error);
      toast.error("Failed to delete folder");
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
    if (!initializedRef.current && folders.length > 0) {
      folders.forEach(folder => {
        mountedFoldersRef.current.add(folder.id);
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
            "hover:border-primary/40 hover:shadow-md",
            "bg-card",
            isOver && "ring-2 ring-primary/30 bg-primary/5 border-primary/50"
          )}
        >
          {/* Left border accent */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
            style={{ backgroundColor: folder.color || "#3b82f6" }}
          />
          
          <CardHeader className="pb-3 pt-4 pl-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Simple folder icon */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: `${folder.color || "#3b82f6"}15`,
                  }}
                >
                  <Folder
                    className="w-5 h-5"
                    style={{ color: folder.color || "#3b82f6" }}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold mb-1">
                    {folder.name || "Unnamed Folder"}
                  </CardTitle>
                  {folder.description && (
                    <CardDescription className="text-xs line-clamp-1">
                      {folder.description}
                    </CardDescription>
                  )}
                </div>
              </div>
              
              {/* Dropdown menu */}
              <div 
                className="relative z-50"
                onClick={(e) => {
                  e.stopPropagation();
                }} 
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
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
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      aria-label="Folder options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end"
                    className="z-[9999] w-48"
                    onCloseAutoFocus={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onFolderClick(folder);
                        }, 150);
                      }}
                      className="cursor-pointer"
                    >
                      <Folder className="w-4 h-4 mr-2" />
                      Open Folder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onEditFolder(folder);
                        }, 150);
                      }}
                      className="cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onDeleteFolder(folder);
                        }, 150);
                      }}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0 pb-4 pl-5">
            <div className="flex items-center justify-between">
              {/* Stats */}
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className="text-xs px-2 py-0.5"
                >
                  {taskCount} {taskCount === 1 ? "task" : "tasks"}
                </Badge>
                <Badge 
                  variant="secondary" 
                  className="text-xs px-2 py-0.5"
                >
                  {projectCount} {projectCount === 1 ? "project" : "projects"}
                </Badge>
              </div>
              
              {/* Open button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFolderClick(folder);
                }}
                aria-label="Open folder"
              >
                <ChevronRight className="w-4 h-4" />
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

  const colorOptions = [
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#f59e0b", // Amber
    "#10b981", // Green
    "#ef4444", // Red
    "#06b6d4", // Cyan
    "#f97316", // Orange
  ];

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
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <AppHeader
        title="Folders"
        panelOpen={true}
        description={`${filteredFolders.length} of ${folders?.length || 0} folder${(folders?.length || 0) === 1 ? "" : "s"}`}
        actions={
          <Button
            onClick={() => {
              setEditingFolder(null);
              setNewFolderName("");
              setNewFolderDescription("");
              setNewFolderColor("#3b82f6");
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
      <div className="md:hidden h-[64px]" />

      {/* Search Bar */}
      <div className="px-4 py-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search folders by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Folders List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3 pb-safe md:pb-4">
          {filteredFolders.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No folders match your search"
                  : "No folders yet"}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setShowAddFolder(true)}
                  className="mt-4"
                  size="sm"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
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
        <DialogContent className="sm:max-w-md">
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
          <div className="space-y-4 py-4">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="folder-description">Description</Label>
              <Input
                id="folder-description"
                placeholder="Optional description"
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewFolderColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      newFolderColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
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
                setNewFolderColor("#3b82f6");
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

