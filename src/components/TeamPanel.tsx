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
import { UserProfileAvatar } from "./UserProfileAvatar";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { AVATAR_UI_TEXT } from "../lib/avatar-constants";
import { pickAvatarFromPool, pickAvatarFromPoolAuto } from "../lib/avatar-utils";
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
import { toast } from "sonner";
import { cn, getAbbreviatedDisplayName } from "../lib/utils";
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
  TEAM_PANEL_GRID_GAP,
  TEAM_PANEL_ROLODEX_CARD_MIN_WIDTH,
  TEAM_PANEL_ROLODEX_TAB_WIDTH,
  TEAM_PANEL_ROLODEX_TAB_HEIGHT,
  TEAM_PANEL_ROLODEX_CARD_OFFSET_TOP,
  TEAM_PANEL_ROLODEX_CARD_PADDING,
  TEAM_PANEL_ROLODEX_CARD_PADDING_TOP,
  TEAM_PANEL_ROLODEX_BORDER_RADIUS,
  TEAM_PANEL_ROLODEX_AVATAR_SIZE,
  TEAM_PANEL_ROLODEX_AVATAR_FONT_SIZE,
  TEAM_PANEL_ROLODEX_NAME_SIZE,
  TEAM_PANEL_ROLODEX_STAT_SIZE,
  TEAM_PANEL_ROLODEX_MENU_BUTTON_SIZE,
  TEAM_PANEL_PROFILE_BANNER_HEIGHT,
  TEAM_PANEL_PROFILE_AVATAR_SIZE,
  TEAM_PANEL_PROFILE_AVATAR_FONT_SIZE,
  TEAM_PANEL_PROFILE_AVATAR_OVERLAP_OFFSET,
  TEAM_MAX_MEMBERS,
  TEAM_PANEL_HEADER_ICON_GAP,
  TEAM_PANEL_TAB_HEIGHT,
  TEAM_PANEL_TAB_PADDING,
  HEADER_BACKDROP_BLUR_CLASS,
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
import { MILLISECONDS_PER_DAY } from "../lib/business-constants";
import { TEAM_PANEL_UI_TEXT } from "../lib/team-panel-constants";
import {
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
    updateTeam,
    deleteTeam,
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
  // Team editing state
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDescription, setEditTeamDescription] = useState("");
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);
  const [showDeleteTeamConfirm, setShowDeleteTeamConfirm] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);

  const handleAddMember = async () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      toast.error(TEAM_PANEL_UI_TEXT.pleaseFillInAllFields);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMemberEmail.trim())) {
      toast.error(TEAM_PANEL_UI_TEXT.pleaseEnterValidEmail);
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
      toast.error(TEAM_PANEL_UI_TEXT.teamMemberWithEmailExists);
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
          toast.error(TEAM_PANEL_UI_TEXT.workspaceNotAvailableTryAgain);
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        console.error('Error ensuring workspace:', error);
        toast.error(TEAM_PANEL_UI_TEXT.workspaceNotAvailableTryAgain);
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
          newMemberAvatar || pickAvatarFromPool(newMemberEmail.trim() || newMemberName.trim(), newMemberGender),
        );
      } else {
        // Legacy workspace-based team
        await addTeamMember({
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
          role: newMemberRole,
          avatar: newMemberAvatar || pickAvatarFromPool(newMemberEmail.trim() || newMemberName.trim(), newMemberGender),
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
      toast.error(TEAM_PANEL_UI_TEXT.cannotRemoveYourself);
      return;
    }

    // Check if member has assigned tasks
    const assignedTasks = tasks.filter((t) =>
      t.assignedTo.includes(member.id),
    );
    if (assignedTasks.length > 0) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotRemoveMember, {
        description: TEAM_PANEL_UI_TEXT.memberHasAssignedTasksReassign(member.name, assignedTasks.length),
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
          toast.error(TEAM_PANEL_UI_TEXT.workspaceNotAvailableTryAgain);
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        toast.error(TEAM_PANEL_UI_TEXT.failedToCreateWorkspaceTryAgain);
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
      toast.error(TEAM_PANEL_UI_TEXT.youCannotChangeOwnRole);
      return;
    }

    // Ensure workspace exists
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      setIsCreatingWorkspace(true);
      try {
        currentWorkspaceId = await ensureWorkspace();
        if (!currentWorkspaceId) {
          toast.error(TEAM_PANEL_UI_TEXT.workspaceNotAvailableTryAgain);
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        toast.error(TEAM_PANEL_UI_TEXT.failedToCreateWorkspaceTryAgain);
        setIsCreatingWorkspace(false);
        return;
      } finally {
        setIsCreatingWorkspace(false);
      }
    }

    // Can't update role for pending invitations
    if (member.id.startsWith('pending_')) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotUpdateRolePendingInvitations);
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
    
    // First check user's role property (workspace owners have admin role)
    if (currentUser.role === 'admin') {
      return true;
    }
    
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
      toast.error(TEAM_PANEL_UI_TEXT.teamNameRequired);
      return;
    }

    let effectiveWorkspaceId = workspaceId;
    if (!effectiveWorkspaceId) {
      setIsCreatingWorkspace(true);
      try {
        effectiveWorkspaceId = await ensureWorkspace();
        if (!effectiveWorkspaceId) {
          toast.error(TEAM_PANEL_UI_TEXT.selectOrCreateWorkspaceFirst);
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        console.error('Error ensuring workspace:', error);
        toast.error(TEAM_PANEL_UI_TEXT.workspaceNotAvailableTryAgain);
        setIsCreatingWorkspace(false);
        return;
      } finally {
        setIsCreatingWorkspace(false);
      }
    }

    setIsCreatingTeam(true);
    try {
      await createTeam(newTeamName.trim(), newTeamDescription.trim() || undefined, effectiveWorkspaceId ?? undefined);
      setNewTeamName("");
      setNewTeamDescription("");
      setShowCreateTeam(false);
    } catch (error) {
      console.error("Failed to create team:", error);
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setEditTeamName(team.name);
    setEditTeamDescription(team.description || "");
    setShowEditTeam(true);
  };

  const handleUpdateTeam = async () => {
    if (!editTeamName.trim()) {
      toast.error(TEAM_PANEL_UI_TEXT.teamNameRequired);
      return;
    }

    if (!editingTeam) {
      return;
    }

    let wsId: string | undefined = workspaceId ?? undefined;
    if (!wsId) {
      try {
        wsId = await ensureWorkspace() ?? undefined;
        if (!wsId) {
          toast.error(TEAM_PANEL_UI_TEXT.selectOrCreateWorkspaceFirst);
          return;
        }
      } catch {
        toast.error(TEAM_PANEL_UI_TEXT.workspaceNotAvailableTryAgain);
        return;
      }
    }

    setIsUpdatingTeam(true);
    try {
      await updateTeam(editingTeam.id, editTeamName.trim(), editTeamDescription.trim() || undefined, wsId);
      setShowEditTeam(false);
      setEditingTeam(null);
      setEditTeamName("");
      setEditTeamDescription("");
    } catch (error) {
      console.error("Failed to update team:", error);
    } finally {
      setIsUpdatingTeam(false);
    }
  };

  const handleDeleteTeam = (team: Team) => {
    setTeamToDelete(team);
    setShowDeleteTeamConfirm(true);
  };

  const confirmDeleteTeam = async () => {
    if (!teamToDelete) {
      return;
    }

    let wsId: string | undefined = workspaceId ?? undefined;
    if (!wsId) {
      try {
        wsId = await ensureWorkspace() ?? undefined;
        if (!wsId) {
          toast.error(TEAM_PANEL_UI_TEXT.selectOrCreateWorkspaceFirst);
          return;
        }
      } catch {
        toast.error(TEAM_PANEL_UI_TEXT.workspaceNotAvailableTryAgain);
        return;
      }
    }

    setIsDeletingTeam(true);
    try {
      await deleteTeam(teamToDelete.id, wsId);
      setShowDeleteTeamConfirm(false);
      setTeamToDelete(null);
    } catch (error) {
      console.error("Failed to delete team:", error);
    } finally {
      setIsDeletingTeam(false);
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
    if (
      member.hasUnreadNotification &&
      member.inviteStatus === "accepted"
    ) {
      markMemberAsViewed(member.id);
    }
    setEditingMember(member);
  };

  const profileMemberStats = useMemo(() => {
    if (!editingMember) return null;
    return getTaskStats(editingMember.id);
  }, [editingMember, tasks]);

  const profileTeamName = useMemo(() => {
    if (!editingMember) return null;
    const teamId = editingMember.teamId || currentTeamId;
    if (!teamId) return TEAM_PANEL_UI_TEXT.workspaceTeam;
    return teams.find((t) => t.id === teamId)?.name ?? null;
  }, [editingMember, currentTeamId, teams]);

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
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / MILLISECONDS_PER_DAY);
    
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
          toast.error(TEAM_PANEL_UI_TEXT.workspaceNotAvailableTryAgain);
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        toast.error(TEAM_PANEL_UI_TEXT.failedToCreateWorkspaceTryAgain);
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
          toast.error(TEAM_PANEL_UI_TEXT.workspaceNotAvailableTryAgain);
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        toast.error(TEAM_PANEL_UI_TEXT.failedToCreateWorkspaceTryAgain);
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
    allTeamMembers: _allTeamMembers,
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

    const roleDisplayText = member.role === 'admin' 
      ? TEAM_PANEL_UI_TEXT.roles.admin 
      : member.role === 'member' 
      ? TEAM_PANEL_UI_TEXT.roles.member 
      : TEAM_PANEL_UI_TEXT.roles.viewer;

    const roleTabColor =
      member.role === 'admin'
        ? COLOR_ROLE_ADMIN
        : member.role === 'viewer'
          ? COLOR_ROLE_VIEWER
          : COLOR_ROLE_MEMBER;
    
    return (
      <div
        className="relative min-w-0"
        style={{ paddingTop: TEAM_PANEL_ROLODEX_CARD_OFFSET_TOP }}
      >
        {/* Rolodex index tab */}
        <div
          className="absolute left-1/2 z-10 -translate-x-1/2 rounded-full"
          style={{
            top: 0,
            width: TEAM_PANEL_ROLODEX_TAB_WIDTH,
            height: TEAM_PANEL_ROLODEX_TAB_HEIGHT,
            backgroundColor: roleTabColor,
          }}
          aria-hidden
        />

        <div
          className={cn(
            'group relative flex min-w-0 cursor-pointer flex-col items-center overflow-hidden border border-border/50 bg-card/95 text-foreground shadow-sm transition-all',
            'hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/30 hover:shadow-md',
            'active:scale-[0.97] active:shadow-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
            HEADER_BACKDROP_BLUR_CLASS,
            isCurrentUser && 'ring-1 ring-primary/20',
          )}
          style={{
            borderRadius: TEAM_PANEL_ROLODEX_BORDER_RADIUS,
            padding: TEAM_PANEL_ROLODEX_CARD_PADDING,
            paddingTop: TEAM_PANEL_ROLODEX_CARD_PADDING_TOP,
          }}
          role="button"
          tabIndex={0}
          aria-label={`View profile for ${member.name}`}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (!dropdownOpen && !target.closest(PANEL_DROPDOWN_MENU_TRIGGER_SELECTOR)) {
              onCardClick(member);
            }
          }}
          onKeyDown={(e) => {
            if (dropdownOpen) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onCardClick(member);
            }
          }}
        >
          {member.hasUnreadNotification && member.inviteStatus === 'accepted' && (
            <div
              className="absolute animate-pulse rounded-full bg-primary"
              style={{
                top: TEAM_PANEL_NOTIFICATION_BADGE_TOP,
                right: TEAM_PANEL_NOTIFICATION_BADGE_RIGHT,
                width: TEAM_PANEL_NOTIFICATION_BADGE_SIZE,
                height: TEAM_PANEL_NOTIFICATION_BADGE_SIZE,
                zIndex: TEAM_PANEL_NOTIFICATION_Z_INDEX,
              }}
            />
          )}

          <div
            className="pointer-events-none absolute top-0 right-0"
            style={{ zIndex: TEAM_PANEL_DROPDOWN_TRIGGER_Z_INDEX }}
          >
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto h-auto w-auto flex-shrink-0 opacity-50 transition-opacity hover:bg-muted/80 hover:opacity-100 focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                  style={{
                    height: TEAM_PANEL_ROLODEX_MENU_BUTTON_SIZE,
                    width: TEAM_PANEL_ROLODEX_MENU_BUTTON_SIZE,
                    minHeight: TEAM_PANEL_ROLODEX_MENU_BUTTON_SIZE,
                    minWidth: TEAM_PANEL_ROLODEX_MENU_BUTTON_SIZE,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  data-slot={PANEL_DROPDOWN_MENU_TRIGGER_DATA_SLOT}
                >
                  <Icon name="more-vertical" size={TEAM_PANEL_ICON_SIZE_SMALL} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                style={{
                  zIndex: TEAM_PANEL_DROPDOWN_Z_INDEX,
                  width: TEAM_PANEL_DROPDOWN_WIDTH,
                }}
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                }}
              >
                {member.inviteStatus === 'pending' && (
                  <>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => onResendInvitation(member), PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
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
                          toast.success(`${member.name} accepted the invitation!`);
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
                        setTimeout(() => onDeclineInvitation(member), PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
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
                    setTimeout(() => onUpdateRole(member, 'admin'), PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                  }}
                  disabled={member.role === 'admin'}
                  className="cursor-pointer"
                >
                  <Icon name="shield-check" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                  Make Admin
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setDropdownOpen(false);
                    setTimeout(() => onUpdateRole(member, 'member'), PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                  }}
                  disabled={member.role === 'member'}
                  className="cursor-pointer"
                >
                  <Icon name="shield" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                  Make Member
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setDropdownOpen(false);
                    setTimeout(() => onUpdateRole(member, 'viewer'), PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
                  }}
                  disabled={member.role === 'viewer'}
                  className="cursor-pointer"
                >
                  <Icon name="eye" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                  Make Viewer
                </DropdownMenuItem>
                <Separator style={{ marginTop: TEAM_PANEL_MARGIN_BOTTOM_SMALL, marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL }} />
                <DropdownMenuItem
                  onSelect={() => {
                    setDropdownOpen(false);
                    setTimeout(() => onRemoveMember(member), PANEL_DROPDOWN_TIMEOUT_DELAY_MS);
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

          <div className="relative flex-shrink-0" style={{ marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL }}>
            <UserProfileAvatar
              src={member.avatar}
              name={member.name}
              size={TEAM_PANEL_ROLODEX_AVATAR_SIZE}
              fontSize={TEAM_PANEL_ROLODEX_AVATAR_FONT_SIZE}
              showRing={false}
              className="ring-1 ring-border/60 ring-offset-1 ring-offset-card"
            />
            {member.hasUnreadNotification && member.inviteStatus === 'accepted' && (
              <div
                className="absolute rounded-full border border-card bg-primary"
                style={{
                  width: TEAM_PANEL_NOTIFICATION_DOT_SIZE,
                  height: TEAM_PANEL_NOTIFICATION_DOT_SIZE,
                  bottom: TEAM_PANEL_NOTIFICATION_DOT_BOTTOM_OFFSET,
                  right: TEAM_PANEL_NOTIFICATION_DOT_RIGHT_OFFSET,
                }}
              />
            )}
          </div>

          <h3
            className="w-full truncate text-center font-semibold text-foreground"
            style={{
              fontSize: TEAM_PANEL_ROLODEX_NAME_SIZE,
              marginBottom: TEAM_PANEL_MARGIN_BOTTOM_SMALL,
              lineHeight: 1.2,
            }}
            title={member.name}
          >
            {getAbbreviatedDisplayName(member.name)}
          </h3>

          <div
            className="flex w-full flex-col items-center"
            style={{ gap: TEAM_PANEL_MARGIN_BOTTOM_SMALL }}
          >
            <Badge
              variant={getRoleBadgeVariant(member.role)}
              className="max-w-full capitalize"
              style={{
                fontSize: TEAM_PANEL_TEXT_SIZE_XS,
                paddingLeft: TEAM_PANEL_BADGE_PADDING_X,
                paddingRight: TEAM_PANEL_BADGE_PADDING_X,
                paddingTop: TEAM_PANEL_BADGE_PADDING_Y,
                paddingBottom: TEAM_PANEL_BADGE_PADDING_Y,
              }}
            >
              <span className="inline-flex items-center truncate" style={{ gap: TEAM_PANEL_MARGIN_RIGHT_SMALL }}>
                {getRoleIcon(member.role)}
                {roleDisplayText}
              </span>
            </Badge>

            {isCurrentUser && (
              <span className="text-primary" style={{ fontSize: TEAM_PANEL_ROLODEX_STAT_SIZE }}>
                {TEAM_PANEL_UI_TEXT.currentUser.replace(/[()]/g, '')}
              </span>
            )}

            {getInviteStatusBadge(member)}

            <span
              className="text-center text-muted-foreground"
              style={{ fontSize: TEAM_PANEL_ROLODEX_STAT_SIZE, lineHeight: 1.2 }}
            >
              <span className="font-semibold text-foreground">{stats.total}</span>{' '}
              {stats.total !== 1 ? TEAM_PANEL_UI_TEXT.stats.tasks : TEAM_PANEL_UI_TEXT.stats.task}
              {stats.completed > 0 && (
                <>
                  {' · '}
                  <span className="font-semibold" style={{ color: COLOR_TASK_COMPLETED_GREEN }}>
                    {stats.completed}
                  </span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  });

  TeamMemberCard.displayName = 'TeamMemberCard';

  const handleBulkInvite = async () => {
    if (!bulkInvites.trim()) {
      toast.error(TEAM_PANEL_UI_TEXT.pleaseEnterEmailAddresses);
      return;
    }

    // Ensure workspace exists
    let currentWorkspaceId = workspaceId;
    if (!currentWorkspaceId) {
      setIsCreatingWorkspace(true);
      try {
        currentWorkspaceId = await ensureWorkspace();
        if (!currentWorkspaceId) {
          toast.error(TEAM_PANEL_UI_TEXT.workspaceNotAvailableTryAgain);
          setIsCreatingWorkspace(false);
          return;
        }
      } catch (error) {
        toast.error(TEAM_PANEL_UI_TEXT.failedToCreateWorkspaceTryAgain);
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
      toast.error(TEAM_PANEL_UI_TEXT.pleaseEnterAtLeastOneEmail);
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

    // Check if any emails already exist in current team/workspace
    const membersToCheck = currentTeamId ? currentTeamMembers : teamMembers;
    const existingEmails = emails.filter(email =>
      membersToCheck.some(m => m.email.toLowerCase() === email.toLowerCase())
    );
    if (existingEmails.length > 0) {
      toast.error(`These emails are already team members: ${existingEmails.join(", ")}`);
      return;
    }

    // Check team member limit if adding to a team
    if (currentTeamId) {
      const team = teams.find(t => t.id === currentTeamId);
      if (team && team.memberCount + emails.length > TEAM_MAX_MEMBERS) {
        toast.error(`Cannot add ${emails.length} members. Team would exceed maximum of ${TEAM_MAX_MEMBERS} members.`);
        return;
      }
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

        const avatar = pickAvatarFromPoolAuto(email);

        if (currentTeamId) {
          // Add to specific team
          await addTeamMemberToTeam(
            currentTeamId,
            {
              name: capitalizedName,
              email,
              role: newMemberRole,
            },
            avatar
          );
        } else {
          // Legacy workspace-based team
          await addTeamMember({
            name: capitalizedName,
            email,
            role: newMemberRole,
            avatar,
          }, currentWorkspaceId);
        }
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

  return (
    <div
      className={cn(
        'flex flex-col bg-background',
        typeof window !== 'undefined' && window.innerWidth < VIEWPORT_BREAKPOINTS.mobile ? 'min-h-full' : 'h-full',
      )}
    >
      {/* Header */}
      <AppHeader
        title={NAVIGATION_UI_TEXT.team}
        panelOpen={true}
        isSidePanelHeader={true}
        description={
          currentTeamId
            ? teams.find(t => t.id === currentTeamId)
              ? `${filteredMembers.length} of ${activeMembers.length} member${activeMembers.length === 1 ? "" : "s"} in ${teams.find(t => t.id === currentTeamId)?.name || "team"}`
              : `${filteredMembers.length} of ${activeMembers.length} member${activeMembers.length === 1 ? "" : "s"}`
            : teams.length > 0
            ? TEAM_PANEL_UI_TEXT.teamsAvailable(teams.length)
            : activeMembers.length === 0
            ? TEAM_PANEL_UI_TEXT.inviteFirstMember
            : `${filteredMembers.length} of ${activeMembers.length} member${activeMembers.length === 1 ? "" : "s"}`
        }
        actions={
          <div className="flex items-center" style={{ gap: TEAM_PANEL_HEADER_ICON_GAP }}>
            {isCurrentUserAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => currentTeamId ? setShowAddMember(true) : setShowCreateTeam(true)}
                      className="cursor-pointer flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          currentTeamId ? setShowAddMember(true) : setShowCreateTeam(true);
                        }
                      }}
                    >
                      <Icon 
                        name={currentTeamId ? "user-plus" : "user-three"}
                        size={ICON_SIZE_XL}
                        className="text-primary dark:text-primary-foreground flex-shrink-0"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{currentTeamId ? TEAM_PANEL_UI_TEXT.addMemberToTeam : TEAM_PANEL_UI_TEXT.createNewTeam}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isCurrentUserAdmin && (teamMembers.length > 0 || (currentTeamId && currentTeamMembers.length > 0)) && (
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
                        name="paper-plane-tilt"
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
          </div>
        }
        hideDesktopLogo
      />

      {/* Teams Tabs - Always show if teams exist, or show workspace team if no teams */}
      <div 
        className={cn('border-b border-border/40 bg-muted/20 min-w-0', HEADER_BACKDROP_BLUR_CLASS)}
        style={{ 
          paddingLeft: PANEL_PADDING,
          paddingRight: PANEL_PADDING,
          paddingTop: TEAM_PANEL_TAB_PADDING,
          paddingBottom: TEAM_PANEL_TAB_PADDING
        }}
      >
        <Tabs 
          value={currentTeamId || "workspace"} 
          onValueChange={(value) => {
            console.log('Team tab clicked:', value);
            selectTeam(value === "workspace" ? null : value);
          }}
        >
          <TabsList className="w-full justify-start overflow-x-auto min-w-0" style={{ height: TEAM_PANEL_TAB_HEIGHT }}>
            <TabsTrigger value="workspace" className="flex-shrink-0 min-w-[theme(spacing.20)]">
              {TEAM_PANEL_UI_TEXT.workspaceTeam}
            </TabsTrigger>
              {isLoadingTeams ? (
              <TabsTrigger value="loading" disabled className="flex-shrink-0 min-w-[theme(spacing.20)]">
                {TEAM_PANEL_UI_TEXT.loadingTeams}
              </TabsTrigger>
            ) : (
              teams.length > 0 ? (
                teams.map((team) => {
                  const memberCount = team.memberCount ?? (team.id === currentTeamId ? currentTeamMembers.length : 0);
                  return (
                    <TabsTrigger key={team.id} value={team.id} className="flex-shrink-0 min-w-[theme(spacing.20)]">
                      {team.name}
                      {memberCount > 0 && (
                        <Badge variant="secondary" className="ml-1" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_XS }}>
                          {memberCount}/{TEAM_MAX_MEMBERS}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })
              ) : null
            )}
          </TabsList>
        </Tabs>
      </div>

      {/* Team Settings Bar - Only show when a specific team is selected */}
      {currentTeamId && isCurrentUserAdmin && (() => {
        const selectedTeam = teams.find(t => t.id === currentTeamId);
        return selectedTeam ? (
          <div 
            className={cn('border-b border-border/40 bg-muted/15', HEADER_BACKDROP_BLUR_CLASS)}
            style={{ 
              paddingLeft: PANEL_PADDING,
              paddingRight: PANEL_PADDING,
              paddingTop: PANEL_GAP_SMALL,
              paddingBottom: PANEL_GAP_SMALL
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="users" size={TEAM_PANEL_ICON_SIZE_MEDIUM} className="text-primary" />
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{selectedTeam.name}</span>
                  {selectedTeam.description && (
                    <span className="text-xs text-muted-foreground">{selectedTeam.description}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center" style={{ gap: PANEL_GAP_SMALL }}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditTeam(selectedTeam)}
                        className="h-8 w-8"
                      >
                        <Icon name="pencil" size={TEAM_PANEL_ICON_SIZE_SMALL} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{TEAM_PANEL_UI_TEXT.editTeam}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTeam(selectedTeam)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Icon name="trash" size={TEAM_PANEL_ICON_SIZE_SMALL} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{TEAM_PANEL_UI_TEXT.deleteTeam}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      {/* Search Bar */}
      <div 
        className="border-b border-border/40"
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
            className="bg-background/80 text-foreground border-border/50"
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
                    {currentTeamId 
                      ? TEAM_PANEL_UI_TEXT.inviteToTeam
                      : TEAM_PANEL_UI_TEXT.inviteFamilyMembers}
                  </p>
                  <Button
                    onClick={() => setShowAddMember(true)}
                    variant="outline"
                    size="sm"
                    style={{ marginTop: TEAM_PANEL_MARGIN_TOP_SMALL }}
                  >
                    <Icon name="user-plus" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                    {currentTeamId ? TEAM_PANEL_UI_TEXT.addMemberToTeam : TEAM_PANEL_UI_TEXT.addFirstMember}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${TEAM_PANEL_ROLODEX_CARD_MIN_WIDTH}, 1fr))`,
                gap: TEAM_PANEL_GRID_GAP,
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
                        {currentTeamId 
                          ? TEAM_PANEL_UI_TEXT.inviteToTeam
                          : TEAM_PANEL_UI_TEXT.inviteFamilyMembers}
                      </p>
                      <Button
                        onClick={() => setShowAddMember(true)}
                        variant="outline"
                        size="sm"
                        style={{ marginTop: TEAM_PANEL_MARGIN_TOP_SMALL }}
                      >
                        <Icon name="user-plus" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                        {currentTeamId ? TEAM_PANEL_UI_TEXT.addMemberToTeam : TEAM_PANEL_UI_TEXT.addFirstMember}
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${TEAM_PANEL_ROLODEX_CARD_MIN_WIDTH}, 1fr))`,
                    gap: TEAM_PANEL_GRID_GAP,
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
              {TEAM_PANEL_UI_TEXT.createTeamDescription(TEAM_MAX_MEMBERS)}
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_SECTION_SPACING, paddingTop: PANEL_PADDING, paddingBottom: PANEL_PADDING }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="team-name">{TEAM_PANEL_UI_TEXT.teamName} *</Label>
              <Input
                id="team-name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder={TEAM_PANEL_UI_TEXT.enterTeamName}
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

      {/* Edit Team Dialog */}
      <Dialog
        open={showEditTeam}
        onOpenChange={setShowEditTeam}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TEAM_PANEL_UI_TEXT.editTeam}</DialogTitle>
            <DialogDescription>
              {TEAM_PANEL_UI_TEXT.editTeamDescription}
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_SECTION_SPACING, paddingTop: PANEL_PADDING, paddingBottom: PANEL_PADDING }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="edit-team-name">{TEAM_PANEL_UI_TEXT.teamName} *</Label>
              <Input
                id="edit-team-name"
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                placeholder={TEAM_PANEL_UI_TEXT.enterTeamName}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="edit-team-description">{TEAM_PANEL_UI_TEXT.teamDescription}</Label>
              <Input
                id="edit-team-description"
                value={editTeamDescription}
                onChange={(e) => setEditTeamDescription(e.target.value)}
                placeholder={TEAM_PANEL_UI_TEXT.optionalDescription}
              />
            </div>
          </div>

          <div className="flex justify-end" style={{ gap: PANEL_GAP_MEDIUM }}>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditTeam(false);
                setEditingTeam(null);
                setEditTeamName("");
                setEditTeamDescription("");
              }}
            >
              {AVATAR_UI_TEXT.cancel}
            </Button>
            <Button
              onClick={handleUpdateTeam}
              disabled={!editTeamName.trim() || isUpdatingTeam}
            >
              {isUpdatingTeam ? TEAM_PANEL_UI_TEXT.updatingTeam : TEAM_PANEL_UI_TEXT.updateTeam}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Team Confirmation Dialog */}
      <Dialog
        open={showDeleteTeamConfirm}
        onOpenChange={setShowDeleteTeamConfirm}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TEAM_PANEL_UI_TEXT.deleteTeam}</DialogTitle>
            <DialogDescription>
              {TEAM_PANEL_UI_TEXT.deleteTeamConfirmation(teamToDelete?.name || '')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end" style={{ gap: PANEL_GAP_MEDIUM, paddingTop: PANEL_PADDING }}>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteTeamConfirm(false);
                setTeamToDelete(null);
              }}
              disabled={isDeletingTeam}
            >
              {AVATAR_UI_TEXT.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteTeam}
              disabled={isDeletingTeam}
            >
              {isDeletingTeam ? TEAM_PANEL_UI_TEXT.deletingTeam : TEAM_PANEL_UI_TEXT.deleteTeam}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Profile Dialog */}
      <Dialog
        open={editingMember !== null}
        onOpenChange={(open) => {
          if (!open) setEditingMember(null);
        }}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-md">
          {editingMember && profileMemberStats && (
            <>
              <div
                className="relative w-full bg-primary/80 dark:bg-primary/60"
                style={{ height: TEAM_PANEL_PROFILE_BANNER_HEIGHT }}
              />
              <div
                style={{
                  marginTop: TEAM_PANEL_PROFILE_AVATAR_OVERLAP_OFFSET,
                  paddingLeft: PANEL_PADDING,
                  paddingRight: PANEL_PADDING,
                }}
              >
                <UserProfileAvatar
                  src={editingMember.avatar}
                  name={editingMember.name}
                  size={TEAM_PANEL_PROFILE_AVATAR_SIZE}
                  fontSize={TEAM_PANEL_PROFILE_AVATAR_FONT_SIZE}
                  className="border-4 border-background shadow-lg ring-0"
                />
              </div>
              <div style={{ padding: PANEL_PADDING, paddingTop: PANEL_GAP_MEDIUM }}>
                <DialogHeader className="space-y-0 text-left">
                  <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
                    <span>{editingMember.name}</span>
                    {editingMember.id === currentUser?.id && (
                      <Badge variant="secondary" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_XS }}>
                        {TEAM_PANEL_UI_TEXT.currentUser.replace(/[()]/g, '')}
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="space-y-3 pt-2">
                      <a
                        href={`mailto:${editingMember.email}`}
                        className="flex items-center text-foreground transition-colors hover:text-primary"
                        style={{ gap: PANEL_GAP_SMALL, fontSize: TEAM_PANEL_TEXT_SIZE_MEDIUM }}
                      >
                        <Icon name="envelope-simple" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
                        {editingMember.email}
                      </a>
                      <div className="flex flex-wrap items-center" style={{ gap: PANEL_GAP_SMALL }}>
                        <Badge variant={getRoleBadgeVariant(editingMember.role)} className="capitalize">
                          <span className="inline-flex items-center" style={{ gap: TEAM_PANEL_MARGIN_RIGHT_SMALL }}>
                            {getRoleIcon(editingMember.role)}
                            {editingMember.role === 'admin'
                              ? TEAM_PANEL_UI_TEXT.roles.admin
                              : editingMember.role === 'member'
                                ? TEAM_PANEL_UI_TEXT.roles.member
                                : TEAM_PANEL_UI_TEXT.roles.viewer}
                          </span>
                        </Badge>
                        {getInviteStatusBadge(editingMember)}
                        {profileTeamName && (
                          <Badge variant="outline" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_XS }}>
                            <Icon name="users" size={TEAM_PANEL_ICON_SIZE_SMALL} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_SMALL }} />
                            {profileTeamName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div
                  className="rounded-lg border border-border/50 bg-muted/20"
                  style={{
                    marginTop: PANEL_GAP_LARGE,
                    padding: PANEL_GAP_MEDIUM,
                  }}
                >
                  <p
                    className="font-medium text-foreground"
                    style={{ fontSize: TEAM_PANEL_TEXT_SIZE_MEDIUM, marginBottom: TEAM_PANEL_MARGIN_BOTTOM_MEDIUM }}
                  >
                    {TEAM_PANEL_UI_TEXT.memberProfile.tasksAssigned}
                  </p>
                  <div
                    className="grid grid-cols-2"
                    style={{ gap: PANEL_GAP_MEDIUM }}
                  >
                    <div>
                      <p className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                        {TEAM_PANEL_UI_TEXT.stats.tasks}
                      </p>
                      <p className="font-semibold text-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_MEDIUM }}>
                        {profileMemberStats.total}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                        {TEAM_PANEL_UI_TEXT.stats.completed}
                      </p>
                      <p className="font-semibold" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_MEDIUM, color: COLOR_TASK_COMPLETED_GREEN }}>
                        {profileMemberStats.completed}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                        {TEAM_PANEL_UI_TEXT.stats.inProgress}
                      </p>
                      <p className="font-semibold text-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_MEDIUM, color: COLOR_TASK_IN_PROGRESS_AMBER }}>
                        {profileMemberStats.inProgress}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}>
                        {TEAM_PANEL_UI_TEXT.stats.todo}
                      </p>
                      <p className="font-semibold text-foreground" style={{ fontSize: TEAM_PANEL_TEXT_SIZE_MEDIUM, color: COLOR_TASK_TODO_BLUE }}>
                        {profileMemberStats.todo}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end" style={{ gap: PANEL_GAP_MEDIUM, marginTop: PANEL_GAP_LARGE }}>
                  <Button variant="outline" asChild>
                    <a href={`mailto:${editingMember.email}`}>
                      <Icon name="paper-plane-tilt" size={TEAM_PANEL_ICON_SIZE_MEDIUM} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_MEDIUM }} />
                      {TEAM_PANEL_UI_TEXT.memberProfile.emailMember}
                    </a>
                  </Button>
                  <Button onClick={() => setEditingMember(null)}>
                    {TEAM_PANEL_UI_TEXT.memberProfile.close}
                  </Button>
                </div>
              </div>
            </>
          )}
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
                className="bg-background/80 text-foreground border-border/50"
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