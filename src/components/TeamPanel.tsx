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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { AvatarSelection, type AvatarGender } from "./AvatarSelection";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { AVATAR_UI_TEXT } from "../lib/avatar-constants";
import { NAVIGATION_UI_TEXT } from "../lib/navigation-constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { useTeam } from "../contexts/TeamContext";
import { useTasks } from "../contexts/TaskContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { toast } from "sonner";
import { cn, getInitials } from "../lib/utils";
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
  ICON_SIZE_XL,
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
  TEAM_PANEL_PROFILE_BANNER_HEIGHT,
  TEAM_PANEL_PROFILE_AVATAR_SIZE,
  TEAM_PANEL_PROFILE_AVATAR_FONT_SIZE,
  TEAM_PANEL_PROFILE_AVATAR_OVERLAP_OFFSET,
  TEAM_PANEL_COMPACT_BANNER_HEIGHT,
  TEAM_PANEL_COMPACT_AVATAR_SIZE,
  TEAM_PANEL_COMPACT_AVATAR_FONT_SIZE,
  TEAM_PANEL_COMPACT_AVATAR_OVERLAP_OFFSET,
  TEAM_PANEL_OTHER_MEMBERS_AVATAR_SIZE,
  TEAM_PANEL_OTHER_MEMBERS_AVATAR_FONT_SIZE,
  TEAM_PANEL_OTHER_MEMBERS_GAP,
  TEAM_PANEL_OTHER_MEMBERS_MAX_VISIBLE,
  TEAM_PANEL_VERTICAL_AVATAR_SIZE,
  TEAM_PANEL_VERTICAL_NAME_SIZE,
  TEAM_PANEL_VERTICAL_ROLE_SIZE,
  TEAM_PANEL_VERTICAL_EMAIL_SIZE,
  TEAM_PANEL_VERTICAL_SOCIAL_ICON_SIZE,
  TEAM_PANEL_HEADER_ICON_GAP,
  TEAM_PANEL_VERTICAL_SPACING,
  TEAM_PANEL_VERTICAL_PADDING,
  TEAM_PANEL_GRID_COLUMNS,
  TEAM_PANEL_GRID_GAP,
  TEAM_MAX_MEMBERS,
  TEAM_PANEL_TAB_HEIGHT,
  TEAM_PANEL_TAB_PADDING,
  PANEL_DROPDOWN_TIMEOUT_DELAY_MS,
  PANEL_DROPDOWN_MENU_TRIGGER_SELECTOR,
  PANEL_DROPDOWN_MENU_TRIGGER_DATA_SLOT,
  PANEL_SEARCH_BAR_PADDING_TOP,
  PANEL_SEARCH_BAR_PADDING_BOTTOM,
  PANEL_SEARCH_ICON_POSITION_LEFT,
  PANEL_SEARCH_INPUT_PADDING_LEFT,
  PANEL_EMPTY_STATE_PADDING_Y,
  PANEL_EMPTY_STATE_TEXT_SIZE,
  TEAM_PANEL_MARGIN_LEFT_SMALL,
  TEAM_PANEL_MARGIN_LEFT_MEDIUM,
  TEAM_PANEL_TEXT_SIZE_XS,
} from "../lib/layout-constants";
import { TEAM_PANEL_UI_TEXT } from "../lib/team-panel-constants";
import {
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_LAVENDER_DARK,
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
    // Legacy workspace-based team
    teamMembers,
    addTeamMember,
    removeTeamMember,
    updateTeamMember,
    markMemberAsViewed,
    acceptInvitation,
    resendInvitation,
    declineInvitation,
    isLoading,
    // New multi-team support
    teams,
    currentTeamId,
    currentTeamMembers,
    isLoadingTeams,
    createTeam,
    selectTeam,
    syncTeams,
    addTeamMemberToTeam,
    removeTeamMemberFromTeam,
    updateTeamMemberInTeam,
  } = useTeam();
  const { tasks, workspaceId, ensureWorkspace, isSyncing } = useTasks();
  const { user: currentUser } = useAuth();
  const [showAddMember, setShowAddMember] = useState(false);
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [editingMember, setEditingMember] =
    useState<User | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<
    "admin" | "member" | "viewer"
  >("member");
  const [newMemberGender, setNewMemberGender] = useState<"male" | "female">(AVATAR_UI_TEXT.defaultGender);
  const [newMemberAvatar, setNewMemberAvatar] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkInvites, setBulkInvites] = useState<string>("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  // Team creation state
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

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

    // Check team member limit (8 max) if adding to a team
    if (currentTeamId) {
      const team = teams.find(t => t.id === currentTeamId);
      if (team && team.memberCount >= TEAM_MAX_MEMBERS) {
        toast.error(TEAM_PANEL_UI_TEXT.maxMembersReached);
        return;
      }
    }

    // Check if email already exists in current team/workspace
    const membersToCheck = currentTeamId ? currentTeamMembers : teamMembers;
    if (
      membersToCheck.some(
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
      if (currentTeamId) {
        // Add to specific team
        await addTeamMemberToTeam(
          currentTeamId,
          {
            name: newMemberName.trim(),
            email: newMemberEmail.trim(),
            role: newMemberRole,
          },
          newMemberAvatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${newMemberName}&backgroundColor=e5e7eb&hairColor=000000&skinColor=fdbcb4&clothingColor=262e33&accessoriesColor=000000&facialHairColor=000000&facialHairProbability=${newMemberGender === 'male' ? '50' : '0'}`,
        );
      } else {
        // Legacy workspace-based team
        await addTeamMember({
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
          role: newMemberRole,
          avatar: newMemberAvatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${newMemberName}&backgroundColor=e5e7eb&hairColor=000000&skinColor=fdbcb4&clothingColor=262e33&accessoriesColor=000000&facialHairColor=000000&facialHairProbability=${newMemberGender === 'male' ? '50' : '0'}`,
        }, currentWorkspaceId);
      }

      // Reset form only on success
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberRole("member");
      setNewMemberGender(AVATAR_UI_TEXT.defaultGender);
      setNewMemberAvatar(undefined);
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
        return <Icon name="shield-check" size={iconSize} />;
      case "member":
        return <Icon name="shield" size={iconSize} />;
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

  // Check if current user is admin
  const isCurrentUserAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (currentTeamId) {
      // Check if user is admin in current team
      const member = currentTeamMembers.find(m => m.id === currentUser.id);
      return member?.role === 'admin';
    }
    // Check legacy workspace team
    const member = teamMembers.find(m => m.id === currentUser.id);
    return member?.role === 'admin';
  }, [currentUser, currentTeamId, currentTeamMembers, teamMembers]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error("Please enter a team name");
      return;
    }

    if (!workspaceId) {
      toast.error("No workspace available");
      return;
    }

    setIsCreatingTeam(true);
    try {
      await createTeam(newTeamName.trim(), newTeamDescription.trim() || undefined);
      setNewTeamName("");
      setNewTeamDescription("");
      setShowCreateTeam(false);
    } catch (error) {
      console.error("Failed to create team:", error);
    } finally {
      setIsCreatingTeam(false);
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

  // Use current team members if a team is selected, otherwise use legacy workspace team
  const activeMembers = currentTeamId ? currentTeamMembers : teamMembers;

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return activeMembers;
    
    const query = searchQuery.toLowerCase();
    return activeMembers.filter(member =>
      member.name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query) ||
      member.role.toLowerCase().includes(query)
    );
  }, [activeMembers, searchQuery]);

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
          <Icon name="x-circle" size={TEAM_PANEL_ICON_SIZE_SMALL} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_SMALL }} />
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
    allTeamMembers,
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
    allTeamMembers: User[];
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
    
    // Get other team members (excluding current member)
    const otherMembers = allTeamMembers.filter(m => m.id !== member.id);
    const visibleOtherMembers = otherMembers.slice(0, TEAM_PANEL_OTHER_MEMBERS_MAX_VISIBLE);
    const remainingCount = Math.max(0, otherMembers.length - TEAM_PANEL_OTHER_MEMBERS_MAX_VISIBLE);

    // Get role display text
    const roleDisplayText = member.role === 'admin' 
      ? TEAM_PANEL_UI_TEXT.roles.admin 
      : member.role === 'member' 
      ? TEAM_PANEL_UI_TEXT.roles.member 
      : TEAM_PANEL_UI_TEXT.roles.viewer;
    
    return (
      <div 
        className="relative w-full bg-white dark:bg-card rounded-lg shadow-sm border border-border/40 overflow-hidden"
        onClick={(e) => {
          // Don't trigger card click if clicking on dropdown area or if dropdown is open
          const target = e.target as HTMLElement;
          if (!dropdownOpen && !target.closest(PANEL_DROPDOWN_MENU_TRIGGER_SELECTOR) && !target.closest('a')) {
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
        
        {/* Action Button (top right) */}
        <div 
          className="absolute top-2 right-2"
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
                  className="flex-shrink-0 hover:bg-muted"
                  style={{ 
                    height: TEAM_PANEL_BUTTON_SIZE_SMALL, 
                    width: TEAM_PANEL_BUTTON_SIZE_SMALL 
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  data-slot={PANEL_DROPDOWN_MENU_TRIGGER_DATA_SLOT}
                >
                  <Icon name="more-vertical" size={TEAM_PANEL_ICON_SIZE_SMALL} />
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
                      <Icon name="paper-plane-tilt" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
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
                  <Icon name="x-circle" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
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
                  <Icon name="shield-check" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
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
                  <Icon name="shield" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
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
                  <Icon name="trash-2" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        {/* Vertical Profile Layout */}
        <div 
          className="flex flex-col items-center"
          style={{ 
            padding: TEAM_PANEL_VERTICAL_PADDING,
            paddingTop: `calc(${TEAM_PANEL_VERTICAL_PADDING} + ${TEAM_PANEL_VERTICAL_SPACING})`
          }}
        >
          {/* Circular Profile Illustration */}
          <div className="relative flex-shrink-0 mb-3" style={{ marginBottom: TEAM_PANEL_VERTICAL_SPACING }}>
            {member.avatar ? (
              <div 
                className="rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border/40"
                style={{
                  width: TEAM_PANEL_VERTICAL_AVATAR_SIZE,
                  height: TEAM_PANEL_VERTICAL_AVATAR_SIZE,
                }}
              >
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className = 'rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold border-2 border-border/40';
                      fallback.style.width = '100%';
                      fallback.style.height = '100%';
                      fallback.style.fontSize = TEAM_PANEL_COMPACT_AVATAR_FONT_SIZE;
                      fallback.textContent = getInitials(member.name);
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
            ) : (
              <div 
                className="rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold border-2 border-border/40"
                style={{ 
                  width: TEAM_PANEL_VERTICAL_AVATAR_SIZE,
                  height: TEAM_PANEL_VERTICAL_AVATAR_SIZE,
                  fontSize: TEAM_PANEL_COMPACT_AVATAR_FONT_SIZE
                }}
              >
                {getInitials(member.name)}
              </div>
            )}
            {member.hasUnreadNotification &&
              member.inviteStatus === "accepted" && (
                <div 
                  className="absolute bg-primary rounded-full border-2 border-white dark:border-card" 
                  style={{ 
                    width: TEAM_PANEL_NOTIFICATION_DOT_SIZE,
                    height: TEAM_PANEL_NOTIFICATION_DOT_SIZE,
                    bottom: TEAM_PANEL_NOTIFICATION_DOT_BOTTOM_OFFSET,
                    right: TEAM_PANEL_NOTIFICATION_DOT_RIGHT_OFFSET
                  }} 
                />
              )}
          </div>

          {/* Name */}
          <h3 
            className="font-semibold text-foreground text-center mb-1 truncate"
            style={{ 
              fontSize: TEAM_PANEL_VERTICAL_NAME_SIZE,
              marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              paddingLeft: TEAM_PANEL_CARD_PADDING,
              paddingRight: TEAM_PANEL_CARD_PADDING,
            }}
          >
            {member.name}
          </h3>

          {/* Role/Job Title */}
          <p 
            className="text-muted-foreground text-center mb-2 capitalize"
            style={{ 
              fontSize: TEAM_PANEL_VERTICAL_ROLE_SIZE,
              marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL
            }}
          >
            <span className="flex items-center justify-center" style={{ gap: PANEL_GAP_SMALL }}>
              {member.role === 'admin' ? (
                <Icon 
                  name="shield-check" 
                  size={TEAM_PANEL_ICON_SIZE_SMALL} 
                  className="text-primary flex-shrink-0" 
                  weight="duotone"
                />
              ) : (
                <Icon 
                  name="user-circle-check" 
                  size={TEAM_PANEL_ICON_SIZE_SMALL} 
                  className="text-muted-foreground flex-shrink-0" 
                />
              )}
              {roleDisplayText}
            </span>
            {getInviteStatusBadge(member) && (
              <span style={{ marginLeft: TEAM_PANEL_MARGIN_LEFT_MEDIUM }}>
                {getInviteStatusBadge(member)}
              </span>
            )}
          </p>

          {/* Email */}
          <div 
            className="text-muted-foreground text-center mb-3"
            style={{ 
              fontSize: TEAM_PANEL_VERTICAL_EMAIL_SIZE,
              marginBottom: TEAM_PANEL_VERTICAL_SPACING,
              paddingLeft: TEAM_PANEL_CARD_PADDING,
              paddingRight: TEAM_PANEL_CARD_PADDING,
            }}
          >
            <a 
              href={`mailto:${member.email}`}
              className="hover:text-primary transition-colors flex items-center justify-center truncate"
              style={{ 
                gap: PANEL_GAP_SMALL,
                maxWidth: '100%',
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Icon 
                name="envelope-simple" 
                size={TEAM_PANEL_ICON_SIZE_SMALL} 
                className="text-muted-foreground flex-shrink-0" 
              />
              <span 
                style={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  minWidth: 0,
                }}
              >
                {member.email}
              </span>
            </a>
          </div>

          {/* Task Stats and Team Info */}
          <div 
            className="w-full text-center"
            style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: TEAM_PANEL_MARGIN_BOTTOM_SMALL,
              paddingTop: TEAM_PANEL_VERTICAL_SPACING,
              borderTop: '1px solid',
              borderColor: 'var(--border)'
            }}
          >
            {/* Task Count */}
            <div className="flex items-center justify-center" style={{ gap: PANEL_GAP_SMALL }}>
              <Icon name="list-checks" size={TEAM_PANEL_ICON_SIZE_SMALL} className="text-muted-foreground" />
              <span className="text-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                <span className="font-semibold">{stats.total}</span> {stats.total !== 1 ? TEAM_PANEL_UI_TEXT.stats.tasks : TEAM_PANEL_UI_TEXT.stats.task}
              </span>
            </div>

            {/* Tasks Completed */}
            {stats.completed > 0 && (
              <div className="flex items-center justify-center" style={{ gap: PANEL_GAP_SMALL }}>
                <Icon 
                  name="check-circle" 
                  size={TEAM_PANEL_ICON_SIZE_SMALL} 
                  style={{ color: COLOR_TASK_COMPLETED_GREEN }}
                />
                <span className="text-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                  <span className="font-semibold">{stats.completed}</span> {TEAM_PANEL_UI_TEXT.stats.completed}
                </span>
              </div>
            )}

            {/* Team Info */}
            {otherMembers.length > 0 && (
              <div className="flex items-center justify-center" style={{ gap: PANEL_GAP_SMALL }}>
                <Icon name="users" size={TEAM_PANEL_ICON_SIZE_SMALL} className="text-muted-foreground" />
                <span className="text-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                  <span className="font-semibold">{otherMembers.length}</span> {otherMembers.length !== 1 ? TEAM_PANEL_UI_TEXT.stats.teamMembers : TEAM_PANEL_UI_TEXT.stats.teamMember}
                </span>
              </div>
            )}
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
          avatar: `https://api.dicebear.com/7.x/lorelei/svg?seed=${capitalizedName}&backgroundColor=e5e7eb&hairColor=000000&skinColor=fdbcb4&clothingColor=262e33&accessoriesColor=000000&facialHairColor=000000&facialHairProbability=25`,
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
  const gradientColor1 = isDark ? COLOR_PASTEL_LAVENDER_DARK : COLOR_PASTEL_LAVENDER;
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
        title={NAVIGATION_UI_TEXT.team}
        panelOpen={true}
        isSidePanelHeader={true}
        description={
          teamMembers.length === 0
            ? "Invite your first team member"
            : `${filteredMembers.length} of ${teamMembers.length} member${teamMembers.length === 1 ? "" : "s"}`
        }
        actions={
          <div className="flex items-center" style={{ gap: TEAM_PANEL_HEADER_ICON_GAP }}>
            {isCurrentUserAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => setShowCreateTeam(true)}
                      className="cursor-pointer flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setShowCreateTeam(true);
                        }
                      }}
                    >
                      <Icon 
                        name="user-three"
                        size={ICON_SIZE_XL}
                        className="text-primary dark:text-primary-foreground flex-shrink-0"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{TEAM_PANEL_UI_TEXT.createNewTeam}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {teamMembers.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => setShowBulkInvite(true)}
                      className="cursor-pointer flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setShowBulkInvite(true);
                        }
                      }}
                    >
                      <Icon 
                        name="users"
                        size={ICON_SIZE_XL}
                        className="text-primary dark:text-primary-foreground flex-shrink-0"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{TEAM_PANEL_UI_TEXT.bulkInvite}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => setShowAddMember(true)}
                    className="cursor-pointer flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setShowAddMember(true);
                      }
                    }}
                  >
                    <Icon 
                      name="user-plus"
                      size={ICON_SIZE_XL}
                      className="text-primary dark:text-primary-foreground flex-shrink-0"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{TEAM_PANEL_UI_TEXT.addMember}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
        hideDesktopLogo
      />

      {/* Teams Tabs - Show if teams exist or user is admin */}
      {(teams.length > 0 || isCurrentUserAdmin) && (
        <div 
          className="border-b border-primary/10"
          style={{ 
            paddingLeft: PANEL_PADDING,
            paddingRight: PANEL_PADDING,
            paddingTop: TEAM_PANEL_TAB_PADDING,
            paddingBottom: TEAM_PANEL_TAB_PADDING
          }}
        >
          <Tabs 
            value={currentTeamId || "workspace"} 
            onValueChange={(value) => selectTeam(value === "workspace" ? null : value)}
          >
            <TabsList className="w-full justify-start overflow-x-auto" style={{ height: TEAM_PANEL_TAB_HEIGHT }}>
              <TabsTrigger value="workspace">
                {TEAM_PANEL_UI_TEXT.workspaceTeam}
              </TabsTrigger>
              {teams.map((team) => (
                <TabsTrigger key={team.id} value={team.id}>
                  {team.name}
                  {team.memberCount > 0 && (
                    <Badge variant="secondary" className="ml-1" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_XS }}>
                      {team.memberCount}/{TEAM_MAX_MEMBERS}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

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
          <Icon 
            name="search"
            size={TEAM_PANEL_SEARCH_ICON_SIZE}
            className="absolute top-1/2 -translate-y-1/2 text-muted-foreground" 
            style={{ 
              left: PANEL_SEARCH_ICON_POSITION_LEFT
            }} 
          />
          <Input
            placeholder={TEAM_PANEL_UI_TEXT.searchMembersPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: PANEL_SEARCH_INPUT_PADDING_LEFT }}
            className="bg-white dark:bg-card text-foreground"
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
              <Icon name="x" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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
              <Icon 
                name="users"
                size={TEAM_PANEL_EMPTY_STATE_ICON_SIZE}
                className="mx-auto text-muted-foreground opacity-50" 
                style={{ 
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
                    <Icon name="user-plus" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                    Add your first member
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div 
              style={{ 
                display: 'grid',
                gridTemplateColumns: `repeat(${TEAM_PANEL_GRID_COLUMNS}, 1fr)`,
                gap: TEAM_PANEL_GRID_GAP
              }}
            >
              {filteredMembers.map((member) => {
                const stats = getTaskStats(member.id);
                const isCurrentUser = member.id === currentUser?.id;

                return (
                  <TeamMemberCard
                    key={member.id}
                    member={member}
                    stats={stats}
                    isCurrentUser={isCurrentUser}
                    allTeamMembers={activeMembers}
                    onCardClick={handleCardClick}
                    onResendInvitation={handleResendInvitation}
                    onDeclineInvitation={handleDeclineInvitation}
                    onUpdateRole={async (member, role) => {
                      if (currentTeamId) {
                        await updateTeamMemberInTeam(currentTeamId, member.id, { role });
                      } else {
                        await handleUpdateRole(member, role);
                      }
                    }}
                    onRemoveMember={async (member) => {
                      if (currentTeamId) {
                        await removeTeamMemberFromTeam(currentTeamId, member.id);
                      } else {
                        await handleRemoveMember(member);
                      }
                    }}
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
                  <Icon 
                    name="users"
                    size={TEAM_PANEL_EMPTY_STATE_ICON_SIZE}
                    className="mx-auto text-muted-foreground opacity-50" 
                    style={{ 
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
                        <Icon name="user-plus" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                        Add your first member
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div 
                  style={{ 
                    display: 'grid',
                    gridTemplateColumns: `repeat(${TEAM_PANEL_GRID_COLUMNS}, 1fr)`,
                    gap: TEAM_PANEL_GRID_GAP
                  }}
                >
                  {filteredMembers.map((member) => {
                    const stats = getTaskStats(member.id);
                    const isCurrentUser = member.id === currentUser?.id;

                    return (
                      <TeamMemberCard
                        key={member.id}
                        member={member}
                        stats={stats}
                        isCurrentUser={isCurrentUser}
                        allTeamMembers={activeMembers}
                        onCardClick={handleCardClick}
                        onResendInvitation={handleResendInvitation}
                        onDeclineInvitation={handleDeclineInvitation}
                    onUpdateRole={async (member, role) => {
                      if (currentTeamId) {
                        await updateTeamMemberInTeam(currentTeamId, member.id, { role });
                      } else {
                        await handleUpdateRole(member, role);
                      }
                    }}
                    onRemoveMember={async (member) => {
                      if (currentTeamId) {
                        await removeTeamMemberFromTeam(currentTeamId, member.id);
                      } else {
                        await handleRemoveMember(member);
                      }
                    }}
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

      {/* Create Team Dialog */}
      <Dialog
        open={showCreateTeam}
        onOpenChange={setShowCreateTeam}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TEAM_PANEL_UI_TEXT.createTeam}</DialogTitle>
            <DialogDescription>
              Create a new team to organize your team members (max {TEAM_MAX_MEMBERS} members per team)
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_SECTION_SPACING, paddingTop: PANEL_PADDING, paddingBottom: PANEL_PADDING }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="team-name">{TEAM_PANEL_UI_TEXT.teamName} *</Label>
              <Input
                id="team-name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="team-description">{TEAM_PANEL_UI_TEXT.teamDescription}</Label>
              <Input
                id="team-description"
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
                placeholder={TEAM_PANEL_UI_TEXT.optionalDescription}
              />
            </div>
          </div>

          <div className="flex justify-end" style={{ gap: PANEL_GAP_MEDIUM }}>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateTeam(false);
                setNewTeamName("");
                setNewTeamDescription("");
              }}
            >
              {AVATAR_UI_TEXT.cancel}
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={!newTeamName.trim() || isCreatingTeam}
            >
              {isCreatingTeam ? AVATAR_UI_TEXT.saving : TEAM_PANEL_UI_TEXT.createTeam}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TEAM_PANEL_UI_TEXT.addTeamMember}</DialogTitle>
            <DialogDescription>
              {TEAM_PANEL_UI_TEXT.addMemberDescription}
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_SECTION_SPACING, paddingTop: PANEL_PADDING, paddingBottom: PANEL_PADDING }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="name">{TEAM_PANEL_UI_TEXT.nameLabel} *</Label>
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
              <Label htmlFor="email">{TEAM_PANEL_UI_TEXT.emailLabel} *</Label>
              <Input
                id="email"
                type="email"
                value={newMemberEmail}
                onChange={(e) =>
                  setNewMemberEmail(e.target.value)
                }
                placeholder="john@example.com"
                className="bg-white dark:bg-card text-foreground"
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
                      <Icon name="shield-check" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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
                      <Icon name="user-circle-check" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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
                      <Icon name="user-circle-check" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label>{AVATAR_UI_TEXT.gender}</Label>
              <RadioGroup
                value={newMemberGender}
                onValueChange={(value) => {
                  setNewMemberGender(value as "male" | "female");
                  setNewMemberAvatar(undefined); // Reset avatar when gender changes
                }}
                style={{ display: 'flex', gap: PANEL_GAP_MEDIUM }}
              >
                <div className="flex items-center" style={{ gap: PANEL_GAP_SMALL }}>
                  <RadioGroupItem value="male" id="new-member-gender-male" />
                  <Label htmlFor="new-member-gender-male" className="cursor-pointer">
                    {AVATAR_UI_TEXT.male}
                  </Label>
                </div>
                <div className="flex items-center" style={{ gap: PANEL_GAP_SMALL }}>
                  <RadioGroupItem value="female" id="new-member-gender-female" />
                  <Label htmlFor="new-member-gender-female" className="cursor-pointer">
                    {AVATAR_UI_TEXT.female}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label>{AVATAR_UI_TEXT.chooseAvatar}</Label>
              <AvatarSelection
                selectedAvatar={newMemberAvatar}
                gender={newMemberGender}
                onAvatarSelect={setNewMemberAvatar}
              />
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
              <Icon name="user-plus" size={TEAM_PANEL_ICON_SIZE_SMALL} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_SMALL }} />
              {TEAM_PANEL_UI_TEXT.bulkInvite}
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
                {isLoading ? TEAM_PANEL_UI_TEXT.adding : TEAM_PANEL_UI_TEXT.addMember}
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
            <DialogTitle>{TEAM_PANEL_UI_TEXT.bulkInviteMembers}</DialogTitle>
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
                {TEAM_PANEL_UI_TEXT.bulkInviteInstructions}
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
                      <Icon name="shield-check" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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
                      <Icon name="user-circle-check" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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
                      <Icon name="user-circle-check" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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
                  <Icon name="loader-2" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} className="animate-spin" />
                  Inviting...
                </>
              ) : (
                <>
                  <Icon name="paper-plane-tilt" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
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