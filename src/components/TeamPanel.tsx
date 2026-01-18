import React, { useState, useMemo } from "react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { AppHeader } from "./AppHeader";
import { HEADER_MOBILE_SAFE_AREA_SPACER, NAV_BAR_BOTTOM_PADDING_MOBILE, VIEWPORT_BREAKPOINTS, MOBILE_PADDING_BOTTOM } from "../lib/layout-constants";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
// Avatar imports removed - using initials badge instead
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { useTeam } from "../contexts/TeamContext";
import { useTasks } from "../contexts/TaskContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import type { User } from "../types";
import {
  PANEL_PADDING,
  PANEL_PADDING_TOP_MOBILE,
  PANEL_PADDING_TOP_DESKTOP,
  PANEL_CONTENT_SPACING,
  PANEL_SECTION_SPACING,
  PANEL_FIELD_SPACING,
  PANEL_GAP_SMALL,
  PANEL_GAP_MEDIUM,
  PANEL_GAP_LARGE,
  TEAM_PANEL_AVATAR_SIZE,
  TEAM_PANEL_AVATAR_BORDER_WIDTH,
  TEAM_PANEL_ICON_SIZE_SMALL,
  TEAM_PANEL_ICON_SIZE_MEDIUM,
  TEAM_PANEL_ICON_SIZE_LARGE,
  TEAM_PANEL_BUTTON_SIZE,
  TEAM_PANEL_BUTTON_SIZE_SMALL,
  TEAM_PANEL_DROPDOWN_WIDTH,
  TEAM_PANEL_ROLE_BORDER_WIDTH,
  TEAM_PANEL_NOTIFICATION_BADGE_SIZE,
  TEAM_PANEL_NOTIFICATION_DOT_SIZE,
  TEAM_PANEL_NOTIFICATION_DOT_BORDER_WIDTH,
  TEAM_PANEL_CARD_PADDING,
  TEAM_PANEL_CARD_PADDING_LEFT,
  TEAM_PANEL_SEARCH_ICON_SIZE,
  TEAM_PANEL_EMPTY_STATE_ICON_SIZE,
  TEAM_PANEL_MOBILE_HEADER_SPACER,
  TEAM_PANEL_BOTTOM_PADDING_MOBILE,
  TEAM_PANEL_DROPDOWN_Z_INDEX,
  TEAM_PANEL_NOTIFICATION_Z_INDEX,
  TEAM_PANEL_DROPDOWN_TRIGGER_Z_INDEX,
  TEAM_PANEL_TEXT_SIZE_SMALL,
  TEAM_PANEL_TEXT_SIZE_MEDIUM,
  TEAM_PANEL_MARGIN_BOTTOM_SMALL,
  TEAM_PANEL_MARGIN_BOTTOM_MEDIUM,
  TEAM_PANEL_MARGIN_BOTTOM_LARGE,
  TEAM_PANEL_MARGIN_BOTTOM_XLARGE,
  TEAM_PANEL_MARGIN_TOP_SMALL,
  TEAM_PANEL_MARGIN_RIGHT_SMALL,
  TEAM_PANEL_MARGIN_RIGHT_MEDIUM,
  TEAM_PANEL_TEXTAREA_MIN_HEIGHT,
  TEAM_PANEL_TEXTAREA_ROWS,
  TEAM_PANEL_BADGE_PADDING_X,
  TEAM_PANEL_BADGE_PADDING_Y,
  TEAM_PANEL_TEXTAREA_PADDING_X,
  TEAM_PANEL_TEXTAREA_PADDING_Y,
  TEAM_PANEL_SEARCH_CLEAR_BUTTON_RIGHT,
  TEAM_PANEL_CONTENT_PADDING_TOP_OFFSET,
  TEAM_PANEL_CARD_BORDER_RADIUS_BOTTOM,
  TEAM_PANEL_CARD_BORDER_RADIUS_TOP,
  TEAM_PANEL_NOTIFICATION_BADGE_TOP,
  TEAM_PANEL_NOTIFICATION_BADGE_RIGHT,
  TEAM_PANEL_NOTIFICATION_DOT_BOTTOM_OFFSET,
  TEAM_PANEL_NOTIFICATION_DOT_RIGHT_OFFSET,
  TEAM_PANEL_CARD_BACKGROUND_HEIGHT,
  PANEL_DROPDOWN_TIMEOUT_DELAY_MS,
  PANEL_DROPDOWN_MENU_TRIGGER_SELECTOR,
  PANEL_DROPDOWN_MENU_TRIGGER_DATA_SLOT,
  PANEL_SEARCH_BAR_PADDING_TOP,
  PANEL_SEARCH_BAR_PADDING_BOTTOM,
  PANEL_SEARCH_ICON_POSITION_LEFT,
  PANEL_SEARCH_INPUT_PADDING_LEFT,
  PANEL_EMPTY_STATE_PADDING_Y,
  PANEL_EMPTY_STATE_TEXT_SIZE,
} from "../lib/layout-constants";
import {
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_SKY_DARK,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_MINT_DARK,
  COLOR_ROLE_ADMIN,
  COLOR_ROLE_MEMBER,
  COLOR_ROLE_VIEWER,
  COLOR_STATUS_EXPIRED_RED,
  COLOR_STATUS_PENDING_AMBER,
  COLOR_STATUS_DECLINED_GRAY,
  COLOR_TASK_COMPLETED_GREEN,
  COLOR_TASK_IN_PROGRESS_AMBER,
  COLOR_TASK_TODO_BLUE,
  COLOR_TEXT_BLACK,
  COLOR_BACKGROUND_TRANSPARENT,
  getColorWithOpacity,
} from "../lib/color-theme";

export function TeamPanel() {
  const {
    teamMembers,
    addTeamMember,
    removeTeamMember,
    updateTeamMember,
    markMemberAsViewed,
    acceptInvitation,
    resendInvitation,
    declineInvitation,
    isLoading,
  } = useTeam();
  const { tasks, workspaceId, ensureWorkspace, isSyncing } = useTasks();
  const { user: currentUser } = useAuth();
  const [showAddMember, setShowAddMember] = useState(false);
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [editingMember, setEditingMember] =
    useState<User | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<
    "admin" | "member" | "viewer"
  >("member");
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkInvites, setBulkInvites] = useState<string>("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  const handleAddMember = async () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMemberEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Check if email already exists
    if (
      teamMembers.some(
        (m) =>
          m.email.toLowerCase() ===
          newMemberEmail.toLowerCase(),
      )
    ) {
      toast.error(
        "A team member with this email already exists",
      );
      return;
    }

    // Ensure workspace exists before proceeding
    // Note: ensureWorkspace will check for existing workspace first before creating
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      setIsCreatingWorkspace(true);
      try {
        // This will check for existing workspace first, only creates if truly missing
        currentWorkspaceId = await ensureWorkspace();
        if (!currentWorkspaceId) {
          toast.error("Workspace is not available. Please try again or refresh the page.");
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        console.error('Error ensuring workspace:', error);
        toast.error("Workspace is not available. Please try again or refresh the page.");
        setIsCreatingWorkspace(false);
        return;
      } finally {
        setIsCreatingWorkspace(false);
      }
    }

    try {
      await addTeamMember({
        name: newMemberName.trim(),
        email: newMemberEmail.trim(),
        role: newMemberRole,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newMemberName}`,
      }, currentWorkspaceId);

      // Reset form only on success
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberRole("member");
      setShowAddMember(false);
    } catch (error) {
      // Error already handled in addTeamMember, but keep dialog open on error
      console.error('Error in handleAddMember:', error);
    }
  };

  const handleRemoveMember = async (member: User) => {
    if (member.id === currentUser?.id) {
      toast.error("You cannot remove yourself from the team");
      return;
    }

    // Check if member has assigned tasks
    const assignedTasks = tasks.filter((t) =>
      t.assignedTo.includes(member.id),
    );
    if (assignedTasks.length > 0) {
      toast.error("Cannot remove member", {
        description: `${member.name} has ${assignedTasks.length} assigned task${assignedTasks.length === 1 ? "" : "s"}. Reassign them first.`,
      });
      return;
    }

    // Ensure workspace exists
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      setIsCreatingWorkspace(true);
      try {
        currentWorkspaceId = await ensureWorkspace();
        if (!currentWorkspaceId) {
          toast.error("Workspace is not available. Please try again.");
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        toast.error("Failed to create workspace. Please try again.");
        setIsCreatingWorkspace(false);
        return;
      } finally {
        setIsCreatingWorkspace(false);
      }
    }

    // Handle pending invitations (they have IDs starting with "pending_")
    if (member.id.startsWith('pending_')) {
      // Just remove from local state for pending invitations
      removeTeamMember(member.id, currentWorkspaceId);
      return;
    }

    try {
      await removeTeamMember(member.id, currentWorkspaceId);
    } catch (error) {
      // Error already handled in removeTeamMember
    }
  };

  const handleUpdateRole = async (
    member: User,
    newRole: "admin" | "member" | "viewer",
  ) => {
    if (member.id === currentUser?.id && newRole !== "admin") {
      toast.error("You cannot change your own role");
      return;
    }

    // Ensure workspace exists
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      setIsCreatingWorkspace(true);
      try {
        currentWorkspaceId = await ensureWorkspace();
        if (!currentWorkspaceId) {
          toast.error("Workspace is not available. Please try again.");
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        toast.error("Failed to create workspace. Please try again.");
        setIsCreatingWorkspace(false);
        return;
      } finally {
        setIsCreatingWorkspace(false);
      }
    }

    // Can't update role for pending invitations
    if (member.id.startsWith('pending_')) {
      toast.error("Cannot update role for pending invitations");
      return;
    }

    try {
      await updateTeamMember(member.id, { role: newRole }, currentWorkspaceId);
    } catch (error) {
      // Error already handled in updateTeamMember
    }
  };

  const getRoleIcon = (role: string) => {
    const iconSize = TEAM_PANEL_ICON_SIZE_MEDIUM;
    switch (role) {
      case "admin":
        return <ShieldCheck style={{ width: iconSize, height: iconSize }} />;
      case "member":
        return <Shield style={{ width: iconSize, height: iconSize }} />;
      case "viewer":
        return <Icon name="eye" size={iconSize} />;
      default:
        return null;
    }
  };

  const getRoleBadgeVariant = (
    role: string,
  ): "default" | "secondary" | "outline" => {
    switch (role) {
      case "admin":
        return "default";
      case "member":
        return "secondary";
      case "viewer":
        return "outline";
      default:
        return "outline";
    }
  };

  const getTaskStats = (memberId: string) => {
    const assignedTasks = tasks.filter((t) =>
      t.assignedTo.includes(memberId),
    );
    const completed = assignedTasks.filter(
      (t) => t.status === "done",
    ).length;
    const inProgress = assignedTasks.filter(
      (t) => t.status === "in-progress",
    ).length;
    const todo = assignedTasks.filter(
      (t) => t.status === "todo",
    ).length;

    return {
      total: assignedTasks.length,
      completed,
      inProgress,
      todo,
    };
  };

  const handleCardClick = (member: User) => {
    // Mark member as viewed to clear notification
    if (
      member.hasUnreadNotification &&
      member.inviteStatus === "accepted"
    ) {
      markMemberAsViewed(member.id);
    }
  };

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return teamMembers;
    
    const query = searchQuery.toLowerCase();
    return teamMembers.filter(member =>
      member.name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query) ||
      member.role.toLowerCase().includes(query)
    );
  }, [teamMembers, searchQuery]);

  // Format expiration date
  const formatExpirationDate = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const date = new Date(expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { text: "Expired", isExpired: true };
    if (daysLeft === 0) return { text: "Expires today", isExpired: false };
    if (daysLeft === 1) return { text: "Expires tomorrow", isExpired: false };
    if (daysLeft <= 7) return { text: `Expires in ${daysLeft} days`, isExpired: false };
    return { text: date.toLocaleDateString(), isExpired: false };
  };

  const getInviteStatusBadge = (member: User) => {
    if (member.inviteStatus === "pending") {
      const expiration = formatExpirationDate(member.expiresAt);
      return (
        <Badge
          variant="outline"
          style={{
            fontSize: TEAM_PANEL_TEXT_SIZE_SMALL,
            backgroundColor: COLOR_BACKGROUND_TRANSPARENT,
            color: COLOR_TEXT_BLACK,
            borderColor: COLOR_TEXT_BLACK
          }}
        >
          <Icon name="clock" size={TEAM_PANEL_ICON_SIZE_SMALL} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_SMALL }} />
          {expiration?.isExpired ? "Expired" : "Pending"}
        </Badge>
      );
    }
    if (member.inviteStatus === "declined") {
      return (
        <Badge
          variant="outline"
          style={{
            fontSize: TEAM_PANEL_TEXT_SIZE_SMALL,
            backgroundColor: COLOR_BACKGROUND_TRANSPARENT,
            color: COLOR_TEXT_BLACK,
            borderColor: COLOR_TEXT_BLACK
          }}
        >
          <XCircle style={{ width: TEAM_PANEL_ICON_SIZE_SMALL, height: TEAM_PANEL_ICON_SIZE_SMALL, marginRight: TEAM_PANEL_MARGIN_RIGHT_SMALL }} />
          Declined
        </Badge>
      );
    }
    return null;
  };

  const handleResendInvitation = async (member: User) => {
    // Ensure workspace exists
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      setIsCreatingWorkspace(true);
      try {
        currentWorkspaceId = await ensureWorkspace();
        if (!currentWorkspaceId) {
          toast.error("Workspace is not available. Please try again.");
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        toast.error("Failed to create workspace. Please try again.");
        setIsCreatingWorkspace(false);
        return;
      } finally {
        setIsCreatingWorkspace(false);
      }
    }
    try {
      await resendInvitation(member.id, currentWorkspaceId);
    } catch (error) {
      // Error already handled in resendInvitation
    }
  };

  const handleDeclineInvitation = async (member: User) => {
    // Ensure workspace exists
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      setIsCreatingWorkspace(true);
      try {
        currentWorkspaceId = await ensureWorkspace();
        if (!currentWorkspaceId) {
          toast.error("Workspace is not available. Please try again.");
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        toast.error("Failed to create workspace. Please try again.");
        setIsCreatingWorkspace(false);
        return;
      } finally {
        setIsCreatingWorkspace(false);
      }
    }
    try {
      await declineInvitation(member.id, currentWorkspaceId);
    } catch (error) {
      // Error already handled in declineInvitation
    }
  };

  // Team Member Card Component with dropdown state
  const TeamMemberCard = React.memo(({ 
    member, 
    stats, 
    isCurrentUser,
    onCardClick,
    onResendInvitation,
    onDeclineInvitation,
    onUpdateRole,
    onRemoveMember,
    getRoleIcon,
    getRoleBadgeVariant,
    getInviteStatusBadge,
    formatExpirationDate,
    acceptInvitation
  }: {
    member: User;
    stats: ReturnType<typeof getTaskStats>;
    isCurrentUser: boolean;
    onCardClick: (member: User) => void;
    onResendInvitation: (member: User) => void;
    onDeclineInvitation: (member: User) => void;
    onUpdateRole: (member: User, role: "admin" | "member" | "viewer") => void;
    onRemoveMember: (member: User) => void;
    getRoleIcon: (role: string) => React.ReactNode;
    getRoleBadgeVariant: (role: string) => "default" | "secondary" | "outline";
    getInviteStatusBadge: (member: User) => React.ReactNode;
    formatExpirationDate: (expiresAt?: string) => { text: string; isExpired: boolean } | null;
    acceptInvitation: (id: string) => void;
  }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);

    return (
      <div 
        className="relative w-full"
        onClick={(e) => {
          // Don't trigger card click if clicking on dropdown area or if dropdown is open
          const target = e.target as HTMLElement;
          if (!dropdownOpen && !target.closest(PANEL_DROPDOWN_MENU_TRIGGER_SELECTOR)) {
            onCardClick(member);
          }
        }}
      >
        {/* Notification Badge */}
        {member.hasUnreadNotification &&
          member.inviteStatus === "accepted" && (
            <div 
              className="absolute" 
              style={{ 
                top: TEAM_PANEL_NOTIFICATION_BADGE_TOP,
                right: TEAM_PANEL_NOTIFICATION_BADGE_RIGHT,
                zIndex: TEAM_PANEL_NOTIFICATION_Z_INDEX 
              }}
            >
              <div 
                className="bg-primary rounded-full animate-pulse" 
                style={{ 
                  width: TEAM_PANEL_NOTIFICATION_BADGE_SIZE, 
                  height: TEAM_PANEL_NOTIFICATION_BADGE_SIZE 
                }} 
              />
            </div>
          )}
        
        {/* Content container */}
        <div
          className="relative w-full"
          style={{
            padding: TEAM_PANEL_CARD_PADDING,
          }}
        >
          <div className="flex items-start" style={{ gap: PANEL_GAP_LARGE }}>
            {/* User Icon on the left */}
            <div className="relative flex-shrink-0">
              <User 
                className="text-foreground" 
                style={{ 
                  width: TEAM_PANEL_AVATAR_SIZE, 
                  height: TEAM_PANEL_AVATAR_SIZE 
                }} 
              />
              {member.hasUnreadNotification &&
                member.inviteStatus === "accepted" && (
                  <div 
                    className="absolute bg-primary rounded-full border-background" 
                    style={{ 
                      width: TEAM_PANEL_NOTIFICATION_DOT_SIZE,
                      height: TEAM_PANEL_NOTIFICATION_DOT_SIZE,
                      borderWidth: TEAM_PANEL_NOTIFICATION_DOT_BORDER_WIDTH,
                      borderStyle: 'solid',
                      bottom: TEAM_PANEL_NOTIFICATION_DOT_BOTTOM_OFFSET,
                      right: TEAM_PANEL_NOTIFICATION_DOT_RIGHT_OFFSET
                    }} 
                  />
                )}
            </div>

            {/* Info Section */}
            <div className="flex-1 min-w-0">
              {/* Name and Role inline */}
              <div className="flex items-center flex-wrap" style={{ gap: PANEL_GAP_MEDIUM, marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL }}>
                <h3 className="font-semibold" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_MEDIUM }}>
                  {member.name}
                  {isCurrentUser && (
                    <span className="font-normal text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL, marginLeft: TEAM_PANEL_MARGIN_RIGHT_SMALL }}>
                      (You)
                    </span>
                  )}
                </h3>
                <Badge
                  variant={getRoleBadgeVariant(member.role)}
                  style={{ 
                    fontSize: TEAM_PANEL_TEXT_SIZE_SMALL, 
                    paddingLeft: TEAM_PANEL_BADGE_PADDING_X, 
                    paddingRight: TEAM_PANEL_BADGE_PADDING_X, 
                    paddingTop: TEAM_PANEL_BADGE_PADDING_Y, 
                    paddingBottom: TEAM_PANEL_BADGE_PADDING_Y
                  }}
                >
                  {getRoleIcon(member.role)}
                  <span className="capitalize" style={{ marginLeft: TEAM_PANEL_MARGIN_RIGHT_SMALL }}>
                    {member.role}
                  </span>
                </Badge>
              </div>
              
              {/* Email */}
              <div className="flex items-center text-muted-foreground" style={{ gap: PANEL_GAP_SMALL, fontSize: TEAM_PANEL_TEXT_SIZE_SMALL, marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL }}>
                <Mail className="flex-shrink-0" style={{ width: TEAM_PANEL_ICON_SIZE_SMALL, height: TEAM_PANEL_ICON_SIZE_SMALL }} />
                <span className="truncate">
                  {member.email}
                </span>
              </div>

              {/* Badging above email */}
              <div className="flex items-center flex-wrap" style={{ gap: PANEL_GAP_MEDIUM, marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL }}>
                {getInviteStatusBadge(member)}
              </div>

              {/* Expiration Date */}
              {member.inviteStatus === "pending" && member.expiresAt && (
                <div className="flex items-center" style={{ gap: PANEL_GAP_SMALL, fontSize: TEAM_PANEL_TEXT_SIZE_SMALL, marginTop: TEAM_PANEL_MARGIN_BOTTOM_SMALL }}>
                  <Calendar 
                    className="flex-shrink-0"
                    style={{ 
                      width: TEAM_PANEL_ICON_SIZE_SMALL, 
                      height: TEAM_PANEL_ICON_SIZE_SMALL,
                      color: formatExpirationDate(member.expiresAt)?.isExpired 
                        ? COLOR_STATUS_EXPIRED_RED 
                        : COLOR_STATUS_PENDING_AMBER
                    }} 
                  />
                  <span 
                    className="font-medium"
                    style={{
                      color: formatExpirationDate(member.expiresAt)?.isExpired 
                        ? COLOR_STATUS_EXPIRED_RED 
                        : COLOR_STATUS_PENDING_AMBER
                    }}
                  >
                    {formatExpirationDate(member.expiresAt)?.text}
                  </span>
                </div>
              )}

              {/* Task Stats */}
              {stats.total > 0 && (
                <div className="flex items-center flex-wrap border-t" style={{ gap: PANEL_GAP_SMALL, marginTop: TEAM_PANEL_MARGIN_TOP_SMALL, paddingTop: TEAM_PANEL_MARGIN_TOP_SMALL }}>
                  <Badge 
                    variant="outline" 
                    style={{ 
                      fontSize: TEAM_PANEL_TEXT_SIZE_SMALL, 
                      paddingLeft: TEAM_PANEL_BADGE_PADDING_X, 
                      paddingRight: TEAM_PANEL_BADGE_PADDING_X, 
                      paddingTop: TEAM_PANEL_BADGE_PADDING_Y, 
                      paddingBottom: TEAM_PANEL_BADGE_PADDING_Y
                    }}
                  >
                    {stats.total} {stats.total === 1 ? "task" : "tasks"}
                  </Badge>
                  {stats.completed > 0 && (
                    <Badge 
                      variant="outline" 
                      style={{ 
                        fontSize: TEAM_PANEL_TEXT_SIZE_SMALL, 
                        paddingLeft: TEAM_PANEL_BADGE_PADDING_X, 
                        paddingRight: TEAM_PANEL_BADGE_PADDING_X, 
                        paddingTop: TEAM_PANEL_BADGE_PADDING_Y, 
                        paddingBottom: TEAM_PANEL_BADGE_PADDING_Y,
                        color: COLOR_TASK_COMPLETED_GREEN,
                        borderColor: getColorWithOpacity(COLOR_TASK_COMPLETED_GREEN, 0.3),
                        backgroundColor: getColorWithOpacity(COLOR_TASK_COMPLETED_GREEN, 0.1)
                      }}
                    >
                      {stats.completed} done
                    </Badge>
                  )}
                  {stats.inProgress > 0 && (
                    <Badge 
                      variant="outline" 
                      style={{ 
                        fontSize: TEAM_PANEL_TEXT_SIZE_SMALL, 
                        paddingLeft: TEAM_PANEL_BADGE_PADDING_X, 
                        paddingRight: TEAM_PANEL_BADGE_PADDING_X, 
                        paddingTop: TEAM_PANEL_BADGE_PADDING_Y, 
                        paddingBottom: TEAM_PANEL_BADGE_PADDING_Y,
                        color: COLOR_TASK_IN_PROGRESS_AMBER,
                        borderColor: getColorWithOpacity(COLOR_TASK_IN_PROGRESS_AMBER, 0.3),
                        backgroundColor: getColorWithOpacity(COLOR_TASK_IN_PROGRESS_AMBER, 0.1)
                      }}
                    >
                      {stats.inProgress} active
                    </Badge>
                  )}
                  {stats.todo > 0 && (
                    <Badge 
                      variant="outline" 
                      style={{ 
                        fontSize: TEAM_PANEL_TEXT_SIZE_SMALL, 
                        paddingLeft: TEAM_PANEL_BADGE_PADDING_X, 
                        paddingRight: TEAM_PANEL_BADGE_PADDING_X, 
                        paddingTop: TEAM_PANEL_BADGE_PADDING_Y, 
                        paddingBottom: TEAM_PANEL_BADGE_PADDING_Y,
                        color: COLOR_TASK_TODO_BLUE,
                        borderColor: getColorWithOpacity(COLOR_TASK_TODO_BLUE, 0.3),
                        backgroundColor: getColorWithOpacity(COLOR_TASK_TODO_BLUE, 0.1)
                      }}
                    >
                      {stats.todo} todo
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Actions Menu */}
            <div 
              className="relative"
              style={{ zIndex: TEAM_PANEL_DROPDOWN_TRIGGER_Z_INDEX }}
              onClick={(e) => e.stopPropagation()}
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
                        height: TEAM_PANEL_BUTTON_SIZE, 
                        width: TEAM_PANEL_BUTTON_SIZE 
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      data-slot={PANEL_DROPDOWN_MENU_TRIGGER_DATA_SLOT}
                    >
                      <MoreVertical style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM }} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end"
                    style={{ 
                      zIndex: TEAM_PANEL_DROPDOWN_Z_INDEX,
                      width: TEAM_PANEL_DROPDOWN_WIDTH
                    }}
                    onCloseAutoFocus={(e) => {
                      e.preventDefault();
                    }}
                  >
                    {member.inviteStatus === "pending" && (
                      <>
                        <DropdownMenuItem
                          onSelect={() => {
                            setDropdownOpen(false);
                            setTimeout(() => {
                              onResendInvitation(member);
                            }, PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                          }}
                          className="cursor-pointer"
                        >
                          <Send style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                          Resend Invitation
                        </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          acceptInvitation(member.id);
                          toast.success(
                            `${member.name} accepted the invitation!`,
                          );
                        }, PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                      }}
                      className="cursor-pointer"
                    >
                      <Icon name="bell" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                      Accept Invite (Demo)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onDeclineInvitation(member);
                        }, PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                      }}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <XCircle style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                      Decline Invitation
                    </DropdownMenuItem>
                    <Separator style={{ marginTop: TEAM_PANEL_MARGIN_BOTTOM_SMALL, marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL }} />
                      </>
                    )}
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onUpdateRole(member, "admin");
                        }, PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                      }}
                      disabled={member.role === "admin"}
                      className="cursor-pointer"
                    >
                      <ShieldCheck style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                      Make Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onUpdateRole(member, "member");
                        }, PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                      }}
                      disabled={member.role === "member"}
                      className="cursor-pointer"
                    >
                      <Shield style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                      Make Member
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onUpdateRole(member, "viewer");
                        }, PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                      }}
                      disabled={member.role === "viewer"}
                      className="cursor-pointer"
                    >
                      <Icon name="eye" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                      Make Viewer
                    </DropdownMenuItem>
                    <Separator style={{ marginTop: TEAM_PANEL_MARGIN_BOTTOM_SMALL, marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL }} />
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onRemoveMember(member);
                        }, PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                      }}
                      className="text-destructive focus:text-destructive cursor-pointer"
                      disabled={isCurrentUser}
                    >
                      <Trash2 style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    );
  });

  TeamMemberCard.displayName = 'TeamMemberCard';

  const handleBulkInvite = async () => {
    if (!bulkInvites.trim()) {
      toast.error("Please enter email addresses");
      return;
    }

    // Ensure workspace exists
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      setIsCreatingWorkspace(true);
      try {
        currentWorkspaceId = await ensureWorkspace();
        if (!currentWorkspaceId) {
          toast.error("Workspace is not available. Please try again.");
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        toast.error("Failed to create workspace. Please try again.");
        setIsCreatingWorkspace(false);
        return;
      } finally {
        setIsCreatingWorkspace(false);
      }
    }

    // Parse email addresses (one per line or comma-separated)
    const emails = bulkInvites
      .split(/[\n,]/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emails.length === 0) {
      toast.error("Please enter at least one email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      toast.error(`Invalid email addresses: ${invalidEmails.join(", ")}`);
      return;
    }

    // Check for duplicates
    const duplicates = emails.filter((email, index) => emails.indexOf(email) !== index);
    if (duplicates.length > 0) {
      toast.error(`Duplicate email addresses: ${duplicates.join(", ")}`);
      return;
    }

    // Check if any emails already exist
    const existingEmails = emails.filter(email =>
      teamMembers.some(m => m.email.toLowerCase() === email.toLowerCase())
    );
    if (existingEmails.length > 0) {
      toast.error(`These emails are already team members: ${existingEmails.join(", ")}`);
      return;
    }

    // Send invitations
    let successCount = 0;
    let errorCount = 0;

    for (const email of emails) {
      try {
        // Extract name from email (before @)
        const name = email.split("@")[0].replace(/[._-]/g, " ");
        const capitalizedName = name
          .split(" ")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        await addTeamMember({
          name: capitalizedName,
          email,
          role: newMemberRole,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${capitalizedName}`,
        }, currentWorkspaceId);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Failed to invite ${email}:`, error);
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully invited ${successCount} member${successCount === 1 ? "" : "s"}`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to invite ${errorCount} member${errorCount === 1 ? "" : "s"}`);
    }

    if (successCount > 0) {
      setBulkInvites("");
      setShowBulkInvite(false);
    }
  };

  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
  // Get appropriate colors based on theme
  const gradientColor1 = isDark ? '#8A7A9A' : COLOR_PASTEL_LAVENDER;
  const gradientColor2 = isDark ? COLOR_PASTEL_SKY_DARK : COLOR_PASTEL_SKY;
  const gradientColor3 = isDark ? COLOR_PASTEL_MINT_DARK : COLOR_PASTEL_MINT;

  return (
    <div
      className={cn("flex flex-col", typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.mobile ? 'min-h-full' : 'h-full')}
      style={{
        background: `linear-gradient(to bottom, ${getColorWithOpacity(gradientColor1, 0.35)}, ${getColorWithOpacity(gradientColor2, 0.35)}, ${getColorWithOpacity(gradientColor3, 0.35)})`,
      } as React.CSSProperties}
    >
      {/* Header */}
      <AppHeader
        title="Team"
        panelOpen={true}
        isSidePanelHeader={true}
        description={
          teamMembers.length === 0
            ? "Invite your first team member"
            : `${filteredMembers.length} of ${teamMembers.length} member${teamMembers.length === 1 ? "" : "s"}`
        }
        actions={
          <div className="flex items-center" style={{ gap: PANEL_GAP_MEDIUM }}>
            {teamMembers.length > 0 && (
              <Button
                onClick={() => setShowBulkInvite(true)}
                variant="outline"
                size="sm"
                className="hidden sm:flex"
              >
                <UserPlus style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                Bulk Invite
              </Button>
            )}
            <Button
              onClick={() => setShowAddMember(true)}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
              size="sm"
            >
              <UserPlus style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
              <span className="hidden sm:inline">Add Member</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        }
        hideDesktopLogo
      />

      {/* Search Bar */}
      <div 
        className="border-b border-primary/10"
        style={{ 
          paddingLeft: PANEL_PADDING,
          paddingRight: PANEL_PADDING,
          paddingTop: PANEL_SEARCH_BAR_PADDING_TOP,
          paddingBottom: PANEL_SEARCH_BAR_PADDING_BOTTOM
        }}
      >
        <div className="relative">
          <Search 
            className="absolute top-1/2 -translate-y-1/2 text-muted-foreground" 
            style={{ 
              left: PANEL_SEARCH_ICON_POSITION_LEFT,
              width: TEAM_PANEL_SEARCH_ICON_SIZE, 
              height: TEAM_PANEL_SEARCH_ICON_SIZE 
            }} 
          />
          <Input
            placeholder="Search members by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: PANEL_SEARCH_INPUT_PADDING_LEFT }}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 -translate-y-1/2"
              style={{ 
                right: TEAM_PANEL_SEARCH_CLEAR_BUTTON_RIGHT,
                height: TEAM_PANEL_BUTTON_SIZE_SMALL, 
                width: TEAM_PANEL_BUTTON_SIZE_SMALL 
              }}
              onClick={() => setSearchQuery("")}
            >
              <X style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM }} />
            </Button>
          )}
        </div>
      </div>

      {/* Team Members List */}
      {/* On mobile, rely on parent scroll container in App.tsx - no ScrollArea */}
      {typeof window !== 'undefined' && window.innerWidth >= VIEWPORT_BREAKPOINTS.mobile ? (
      <ScrollArea className="flex-1">
        <div 
          className="pb-safe md:pb-4" 
          style={{ 
            padding: PANEL_PADDING,
            paddingTop: `calc(${PANEL_PADDING_TOP_MOBILE} + ${TEAM_PANEL_CONTENT_PADDING_TOP_OFFSET})`,
            paddingBottom: TEAM_PANEL_BOTTOM_PADDING_MOBILE,
            gap: PANEL_CONTENT_SPACING
          }}
        >
          {filteredMembers.length === 0 ? (
            <div 
              className="text-center" 
              style={{ 
                paddingTop: PANEL_EMPTY_STATE_PADDING_Y, 
                paddingBottom: PANEL_EMPTY_STATE_PADDING_Y
              }}
            >
              <Users 
                className="mx-auto text-muted-foreground opacity-50" 
                style={{ 
                  width: TEAM_PANEL_EMPTY_STATE_ICON_SIZE, 
                  height: TEAM_PANEL_EMPTY_STATE_ICON_SIZE,
                  marginBottom: TEAM_PANEL_MARGIN_BOTTOM_LARGE
                }} 
              />
              <p 
                className="text-muted-foreground" 
                style={{ 
                  fontSize: PANEL_EMPTY_STATE_TEXT_SIZE, 
                  marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL
                }}
              >
                {searchQuery ? "No members match your search" : "No team members yet"}
              </p>
              {!searchQuery && (
                <>
                  <p 
                    className="text-muted-foreground" 
                    style={{ 
                      fontSize: TEAM_PANEL_TEXT_SIZE_SMALL, 
                      marginBottom: TEAM_PANEL_MARGIN_BOTTOM_XLARGE
                    }}
                  >
                    Invite family members or teammates to collaborate
                  </p>
                  <Button
                    onClick={() => setShowAddMember(true)}
                    variant="outline"
                    size="sm"
                    style={{ marginTop: TEAM_PANEL_MARGIN_TOP_SMALL }}
                  >
                    <UserPlus style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                    Add your first member
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_CONTENT_SPACING }}>
              {filteredMembers.map((member) => {
                const stats = getTaskStats(member.id);
                const isCurrentUser = member.id === currentUser?.id;

                return (
                  <TeamMemberCard
                    key={member.id}
                    member={member}
                    stats={stats}
                    isCurrentUser={isCurrentUser}
                    onCardClick={handleCardClick}
                    onResendInvitation={handleResendInvitation}
                    onDeclineInvitation={handleDeclineInvitation}
                    onUpdateRole={handleUpdateRole}
                    onRemoveMember={handleRemoveMember}
                    getRoleIcon={getRoleIcon}
                    getRoleBadgeVariant={getRoleBadgeVariant}
                    getInviteStatusBadge={getInviteStatusBadge}
                    formatExpirationDate={formatExpirationDate}
                    acceptInvitation={acceptInvitation}
                  />
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
      ) : (
          <div className="flex-1">
            <div 
              className="pb-safe md:pb-4" 
              style={{ 
                padding: PANEL_PADDING,
                paddingTop: `calc(${PANEL_PADDING_TOP_MOBILE} + ${TEAM_PANEL_CONTENT_PADDING_TOP_OFFSET})`,
                paddingBottom: `calc(${TEAM_PANEL_BOTTOM_PADDING_MOBILE} + ${MOBILE_PADDING_BOTTOM})`,
                gap: PANEL_CONTENT_SPACING
              }}
            >
              {filteredMembers.length === 0 ? (
                <div 
                  className="text-center" 
                  style={{
                    paddingTop: PANEL_EMPTY_STATE_PADDING_Y, 
                    paddingBottom: PANEL_EMPTY_STATE_PADDING_Y
                  }}
                >
                  <Users 
                    className="mx-auto text-muted-foreground opacity-50" 
                    style={{ 
                      width: TEAM_PANEL_EMPTY_STATE_ICON_SIZE, 
                      height: TEAM_PANEL_EMPTY_STATE_ICON_SIZE,
                      marginBottom: TEAM_PANEL_MARGIN_BOTTOM_LARGE
                    }} 
                  />
                  <p 
                    className="text-muted-foreground" 
                    style={{ 
                      fontSize: PANEL_EMPTY_STATE_TEXT_SIZE, 
                      marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL
                    }}
                  >
                    {searchQuery ? "No members match your search" : "No team members yet"}
                  </p>
                  {!searchQuery && (
                    <>
                      <p 
                        className="text-muted-foreground" 
                        style={{ 
                          fontSize: TEAM_PANEL_TEXT_SIZE_SMALL, 
                          marginBottom: TEAM_PANEL_MARGIN_BOTTOM_XLARGE
                        }}
                      >
                        Invite family members or teammates to collaborate
                      </p>
                      <Button
                        onClick={() => setShowAddMember(true)}
                        variant="outline"
                        size="sm"
                        style={{ marginTop: TEAM_PANEL_MARGIN_TOP_SMALL }}
                      >
                        <UserPlus style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                        Add your first member
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_CONTENT_SPACING }}>
                  {filteredMembers.map((member) => {
                    const stats = getTaskStats(member.id);
                    const isCurrentUser = member.id === currentUser?.id;

                    return (
                      <TeamMemberCard
                        key={member.id}
                        member={member}
                        stats={stats}
                        isCurrentUser={isCurrentUser}
                        onCardClick={handleCardClick}
                        onResendInvitation={handleResendInvitation}
                        onDeclineInvitation={handleDeclineInvitation}
                        onUpdateRole={handleUpdateRole}
                        onRemoveMember={handleRemoveMember}
                        getRoleIcon={getRoleIcon}
                        getRoleBadgeVariant={getRoleBadgeVariant}
                        getInviteStatusBadge={getInviteStatusBadge}
                        formatExpirationDate={formatExpirationDate}
                        acceptInvitation={acceptInvitation}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Add Member Dialog */}
      <Dialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Invite a new member to collaborate on tasks
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_SECTION_SPACING, paddingTop: PANEL_PADDING, paddingBottom: PANEL_PADDING }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={newMemberName}
                onChange={(e) =>
                  setNewMemberName(e.target.value)
                }
                placeholder="John Doe"
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newMemberEmail}
                onChange={(e) =>
                  setNewMemberEmail(e.target.value)
                }
                placeholder="john@example.com"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="role">Role</Label>
              <Select
                value={newMemberRole}
                onValueChange={(value: any) =>
                  setNewMemberRole(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center" style={{ gap: PANEL_GAP_MEDIUM }}>
                      <ShieldCheck style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM }} />
                      <div>
                        <div>Admin</div>
                        <div className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                          Full access
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div className="flex items-center" style={{ gap: PANEL_GAP_MEDIUM }}>
                      <Shield style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM }} />
                      <div>
                        <div>Member</div>
                        <div className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                          Can edit tasks
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center" style={{ gap: PANEL_GAP_MEDIUM }}>
                      <Icon name="eye" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
                      <div>
                        <div>Viewer</div>
                        <div className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                          Read-only access
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddMember(false);
                setShowBulkInvite(true);
              }}
              style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}
            >
              <UserPlus style={{ width: TEAM_PANEL_ICON_SIZE_SMALL, height: TEAM_PANEL_ICON_SIZE_SMALL, marginRight: TEAM_PANEL_MARGIN_RIGHT_SMALL }} />
              Bulk Invite
            </Button>
            <div className="flex" style={{ gap: PANEL_GAP_MEDIUM }}>
              <Button
                variant="outline"
                onClick={() => setShowAddMember(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddMember}
                disabled={!newMemberName.trim() || !newMemberEmail.trim() || isLoading}
              >
                {isLoading ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Invite Dialog */}
      <Dialog
        open={showBulkInvite}
        onOpenChange={setShowBulkInvite}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Invite Members</DialogTitle>
            <DialogDescription>
              Invite multiple members at once. Enter one email per line or comma-separated.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_SECTION_SPACING, paddingTop: PANEL_PADDING, paddingBottom: PANEL_PADDING }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="bulk-emails">Email Addresses *</Label>
              <textarea
                id="bulk-emails"
                value={bulkInvites}
                onChange={(e) => setBulkInvites(e.target.value)}
                placeholder="john@example.com&#10;jane@example.com&#10;bob@example.com"
                className="flex w-full rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  minHeight: TEAM_PANEL_TEXTAREA_MIN_HEIGHT,
                  paddingLeft: TEAM_PANEL_TEXTAREA_PADDING_X,
                  paddingRight: TEAM_PANEL_TEXTAREA_PADDING_X,
                  paddingTop: TEAM_PANEL_TEXTAREA_PADDING_Y,
                  paddingBottom: TEAM_PANEL_TEXTAREA_PADDING_Y,
                  fontSize: TEAM_PANEL_TEXT_SIZE_MEDIUM
                }}
                rows={TEAM_PANEL_TEXTAREA_ROWS}
              />
              <p className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                One email per line or comma-separated. Names will be auto-generated from emails.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="bulk-role">Role</Label>
              <Select
                value={newMemberRole}
                onValueChange={(value: any) =>
                  setNewMemberRole(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center" style={{ gap: PANEL_GAP_MEDIUM }}>
                      <ShieldCheck style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM }} />
                      <div>
                        <div>Admin</div>
                        <div className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                          Full access
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div className="flex items-center" style={{ gap: PANEL_GAP_MEDIUM }}>
                      <Shield style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM }} />
                      <div>
                        <div>Member</div>
                        <div className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                          Can edit tasks
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center" style={{ gap: PANEL_GAP_MEDIUM }}>
                      <Icon name="eye" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
                      <div>
                        <div>Viewer</div>
                        <div className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                          Read-only access
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end" style={{ gap: PANEL_GAP_MEDIUM }}>
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkInvite(false);
                setBulkInvites("");
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBulkInvite}
              disabled={!bulkInvites.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} className="animate-spin" />
                  Inviting...
                </>
              ) : (
                <>
                  <Send style={{ width: TEAM_PANEL_ICON_SIZE_MEDIUM, height: TEAM_PANEL_ICON_SIZE_MEDIUM, marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                  Send Invitations
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}