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
import { AVATAR_UI_TEXT, AVATAR_SELECTION_DIALOG_BODY_CLASS, AVATAR_SELECTION_DIALOG_CLASS, AVATAR_SELECTION_DIALOG_FOOTER_CLASS, DEFAULT_AVATAR_GENDER } from "../lib/avatar-constants";
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
import { useMobileLayout } from "../hooks/useMobileLayout";
import { TeamOverviewBar } from "./team/TeamOverviewBar";
import { TeamSectionNav, type TeamPanelSection } from "./team/TeamSectionNav";
import { TeamMemberRow } from "./team/TeamMemberRow";
import { TeamInviteRow } from "./team/TeamInviteRow";
import { TeamAssignedTasksList } from "./team/TeamAssignedTasksList";
import { TeamMemberProfileDialog } from "./team/TeamMemberProfileDialog";
import {
  getAcceptedMembers,
  getAssignedTasksForMembers,
  getMemberTaskStats,
  getPendingMembers,
} from "../lib/team-utils";
import { toast } from "sonner";
import { cn, getAbbreviatedDisplayName } from "../lib/utils";
import type { User, Team } from "../types";
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
    syncTeamMembers,
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
  const [newMemberAvatar, setNewMemberAvatar] = useState<string | undefined>(undefined);
  const [newMemberGender, setNewMemberGender] = useState<AvatarGender>(DEFAULT_AVATAR_GENDER);
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
  /** Target team when adding members (null = workspace team). */
  const [inviteTargetTeamId, setInviteTargetTeamId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<TeamPanelSection>('members');
  const shouldUseMobileLayout = useMobileLayout();

  const openAddMemberDialog = () => {
    setInviteTargetTeamId(currentTeamId);
    setShowAddMember(true);
  };

  const openBulkInviteDialog = () => {
    setInviteTargetTeamId(currentTeamId);
    setShowBulkInvite(true);
  };

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
    if (inviteTargetTeamId) {
      const team = teams.find(t => t.id === inviteTargetTeamId);
      const memberCount = inviteTargetTeamId === currentTeamId
        ? Math.max(team?.memberCount ?? 0, currentTeamMembers.length)
        : (team?.memberCount ?? 0);
      if (memberCount >= TEAM_MAX_MEMBERS) {
        toast.error(TEAM_PANEL_UI_TEXT.maxMembersReached);
        return;
      }
    }

    // Check if email already exists in target team/workspace
    const membersToCheck = inviteTargetTeamId
      ? (inviteTargetTeamId === currentTeamId
          ? currentTeamMembers
          : teamMembers.filter(m => m.teamId === inviteTargetTeamId))
      : teamMembers;
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
      if (inviteTargetTeamId) {
        await addTeamMemberToTeam(
          inviteTargetTeamId,
          {
            name: newMemberName.trim(),
            email: newMemberEmail.trim(),
            role: newMemberRole,
          },
          newMemberAvatar || pickAvatarFromPool(newMemberEmail.trim() || newMemberName.trim(), newMemberGender),
        );
      } else {
        await addTeamMember({
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
          role: newMemberRole,
          avatar: newMemberAvatar || pickAvatarFromPool(newMemberEmail.trim() || newMemberName.trim(), newMemberGender),
        }, currentWorkspaceId);
      }

      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberRole("member");
      setNewMemberAvatar(undefined);
      setInviteTargetTeamId(currentTeamId);
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

    // Handle pending invitations
    if (member.id.startsWith('pending_')) {
      if (currentTeamId) {
        await removeTeamMemberFromTeam(currentTeamId, member.id);
      } else {
        await declineInvitation(member.id, currentWorkspaceId);
      }
      return;
    }

    try {
      if (currentTeamId) {
        await removeTeamMemberFromTeam(currentTeamId, member.id);
      } else {
        await removeTeamMember(member.id, currentWorkspaceId);
      }
    } catch (error) {
      // Error already handled in removeTeamMember / removeTeamMemberFromTeam
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

    try {
      if (currentTeamId) {
        await updateTeamMemberInTeam(currentTeamId, member.id, { role: newRole });
      } else {
        await updateTeamMember(member.id, { role: newRole }, currentWorkspaceId);
      }
    } catch (error) {
      // Error already handled in updateTeamMember / updateTeamMemberInTeam
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

  const getTaskStats = (memberId: string) => getMemberTaskStats(memberId, tasks);

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

  const activeMembers = currentTeamId ? currentTeamMembers : teamMembers;
  const acceptedMembers = useMemo(() => getAcceptedMembers(activeMembers), [activeMembers]);
  const pendingMembers = useMemo(() => getPendingMembers(activeMembers), [activeMembers]);
  const assignedTasksForTeam = useMemo(
    () => getAssignedTasksForMembers(activeMembers, tasks),
    [activeMembers, tasks],
  );
  const selectedTeam = currentTeamId ? teams.find((team) => team.id === currentTeamId) : null;

  const filteredAcceptedMembers = useMemo(() => {
    if (!searchQuery.trim()) return acceptedMembers;

    const query = searchQuery.toLowerCase();
    return acceptedMembers.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query),
    );
  }, [acceptedMembers, searchQuery]);

  const profileAssignedTasks = useMemo(() => {
    if (!editingMember) return [];
    return tasks.filter((task) => task.assignedTo?.includes(editingMember.id));
  }, [editingMember, tasks]);

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

    // Check if any emails already exist in target team/workspace
    const membersToCheck = inviteTargetTeamId
      ? (inviteTargetTeamId === currentTeamId ? currentTeamMembers : [])
      : teamMembers;
    const existingEmails = emails.filter(email =>
      membersToCheck.some(m => m.email.toLowerCase() === email.toLowerCase())
    );
    if (existingEmails.length > 0) {
      toast.error(`These emails are already team members: ${existingEmails.join(", ")}`);
      return;
    }

    // Check team member limit if adding to a team
    if (inviteTargetTeamId) {
      const team = teams.find(t => t.id === inviteTargetTeamId);
      const baseCount = inviteTargetTeamId === currentTeamId
        ? Math.max(team?.memberCount ?? 0, currentTeamMembers.length)
        : (team?.memberCount ?? 0);
      if (baseCount + emails.length > TEAM_MAX_MEMBERS) {
        toast.error(TEAM_PANEL_UI_TEXT.maxMembersLimit(TEAM_MAX_MEMBERS));
        return;
      }
    }

    // Send invitations
    let successCount = 0;
    let errorCount = 0;

    for (const email of emails) {
      if (inviteTargetTeamId) {
        const team = teams.find(t => t.id === inviteTargetTeamId);
        const baseCount = inviteTargetTeamId === currentTeamId
          ? Math.max(team?.memberCount ?? 0, currentTeamMembers.length)
          : (team?.memberCount ?? 0);
        if (baseCount + successCount >= TEAM_MAX_MEMBERS) {
          errorCount++;
          continue;
        }
      }

      try {
        const name = email.split("@")[0].replace(/[._-]/g, " ");
        const capitalizedName = name
          .split(" ")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        const avatar = pickAvatarFromPoolAuto(email);
        const inviteOptions = {
          silent: true,
          skipRefresh: true,
          batchInviteIndex: successCount,
        };

        if (inviteTargetTeamId) {
          await addTeamMemberToTeam(
            inviteTargetTeamId,
            {
              name: capitalizedName,
              email,
              role: newMemberRole,
            },
            avatar,
            inviteOptions,
          );
        } else {
          await addTeamMember(
            {
              name: capitalizedName,
              email,
              role: newMemberRole,
              avatar,
            },
            currentWorkspaceId,
            inviteOptions,
          );
        }
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Failed to invite ${email}:`, error);
      }
    }

    if (successCount > 0) {
      try {
        if (inviteTargetTeamId) {
          await selectTeam(inviteTargetTeamId);
          await syncTeams(currentWorkspaceId, true);
        } else {
          await syncTeamMembers(currentWorkspaceId);
        }
      } catch (refreshError) {
        console.error('Failed to refresh members after bulk invite:', refreshError);
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

  const teamLabel = selectedTeam?.name ?? TEAM_PANEL_UI_TEXT.workspaceTeam;
  const teamDescription = selectedTeam
    ? (selectedTeam.description || TEAM_PANEL_UI_TEXT.overview.teamDescription(selectedTeam.name))
    : TEAM_PANEL_UI_TEXT.overview.workspaceDescription;

  const renderSectionContent = () => {
    if (activeSection === 'tasks') {
      return (
        <TeamAssignedTasksList
          tasks={assignedTasksForTeam}
          members={activeMembers}
          onViewMember={handleCardClick}
        />
      );
    }

    if (activeSection === 'invites') {
      if (pendingMembers.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Icon name="paper-plane-tilt" size={40} className="mb-4 text-muted-foreground/50" />
            <p className="font-medium text-foreground">{TEAM_PANEL_UI_TEXT.overview.emptyInvites}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {TEAM_PANEL_UI_TEXT.overview.emptyInvitesHint}
            </p>
            {isCurrentUserAdmin ? (
              <Button type="button" className="mt-4 gap-2" onClick={openAddMemberDialog}>
                <Icon name="user-plus" size={18} />
                {TEAM_PANEL_UI_TEXT.overview.inviteMember}
              </Button>
            ) : null}
          </div>
        );
      }

      return (
        <div className="space-y-3">
          {pendingMembers.map((member) => (
            <TeamInviteRow
              key={member.id}
              member={member}
              canManageTeam={isCurrentUserAdmin}
              onResend={handleResendInvitation}
              onCancel={handleDeclineInvitation}
            />
          ))}
        </div>
      );
    }

    if (filteredAcceptedMembers.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <Icon name="users" size={40} className="mb-4 text-muted-foreground/50" />
          <p className="font-medium text-foreground">
            {searchQuery
              ? TEAM_PANEL_UI_TEXT.overview.noSearchResults
              : TEAM_PANEL_UI_TEXT.overview.emptyMembers}
          </p>
          {!searchQuery && isCurrentUserAdmin ? (
            <>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {currentTeamId
                  ? TEAM_PANEL_UI_TEXT.inviteToTeam
                  : TEAM_PANEL_UI_TEXT.inviteFamilyMembers}
              </p>
              <Button type="button" className="mt-4 gap-2" onClick={openAddMemberDialog}>
                <Icon name="user-plus" size={18} />
                {TEAM_PANEL_UI_TEXT.overview.inviteMember}
              </Button>
            </>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredAcceptedMembers.map((member) => (
          <TeamMemberRow
            key={member.id}
            member={member}
            stats={getTaskStats(member.id)}
            isCurrentUser={member.id === currentUser?.id}
            canManageTeam={isCurrentUserAdmin}
            onViewProfile={handleCardClick}
            onUpdateRole={handleUpdateRole}
            onRemoveMember={handleRemoveMember}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex min-w-0 w-full flex-col overflow-x-hidden bg-background',
        shouldUseMobileLayout ? 'min-h-full' : 'h-full',
      )}
    >
      <AppHeader
        title={NAVIGATION_UI_TEXT.team}
        panelOpen={true}
        isSidePanelHeader={true}
        description={
          isSyncing
            ? 'Syncing team…'
            : `${acceptedMembers.length} active · ${pendingMembers.length} pending · ${assignedTasksForTeam.length} assigned`
        }
        hideDesktopLogo
      />

      <TeamOverviewBar
        teamLabel={teamLabel}
        teamDescription={teamDescription}
        memberCount={acceptedMembers.length}
        assignedTaskCount={assignedTasksForTeam.length}
        pendingInviteCount={pendingMembers.length}
        teams={teams}
        currentTeamId={currentTeamId}
        isLoadingTeams={isLoadingTeams}
        canManageTeam={isCurrentUserAdmin}
        onTeamChange={selectTeam}
        onInvite={openAddMemberDialog}
        onBulkInvite={openBulkInviteDialog}
        onCreateTeam={() => setShowCreateTeam(true)}
        onEditTeam={
          selectedTeam && isCurrentUserAdmin
            ? () => handleEditTeam(selectedTeam)
            : undefined
        }
      />

      <TeamSectionNav
        activeSection={activeSection}
        memberCount={acceptedMembers.length}
        assignedTaskCount={assignedTasksForTeam.length}
        pendingInviteCount={pendingMembers.length}
        onSectionChange={setActiveSection}
      />

      {activeSection === 'members' ? (
        <div
          className="border-b border-border/40 px-4 py-3"
        >
          <div className="relative">
            <Icon
              name="search"
              size={TEAM_PANEL_SEARCH_ICON_SIZE}
              className="absolute top-1/2 -translate-y-1/2 text-muted-foreground"
              style={{ left: PANEL_SEARCH_ICON_POSITION_LEFT }}
            />
            <Input
              placeholder={TEAM_PANEL_UI_TEXT.overview.searchMembers}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{ paddingLeft: PANEL_SEARCH_INPUT_PADDING_LEFT }}
              className="bg-background/80 text-foreground border-border/50"
            />
            {searchQuery ? (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  right: TEAM_PANEL_SEARCH_CLEAR_BUTTON_RIGHT,
                  height: TEAM_PANEL_BUTTON_SIZE_SMALL,
                  width: TEAM_PANEL_BUTTON_SIZE_SMALL,
                }}
                onClick={() => setSearchQuery('')}
              >
                <Icon name="x" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {shouldUseMobileLayout ? (
        <div
          className="flex-1 px-4 py-4"
          style={{ paddingBottom: `calc(${TEAM_PANEL_BOTTOM_PADDING_MOBILE} + ${MOBILE_PADDING_BOTTOM})` }}
        >
          {renderSectionContent()}
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div
            className="px-4 py-4"
            style={{ paddingBottom: TEAM_PANEL_BOTTOM_PADDING_MOBILE }}
          >
            {renderSectionContent()}
          </div>
        </ScrollArea>
      )}

      <TeamMemberProfileDialog
        member={editingMember}
        stats={profileMemberStats}
        teamName={profileTeamName}
        assignedTasks={profileAssignedTasks}
        isCurrentUser={editingMember?.id === currentUser?.id}
        inviteStatusBadge={editingMember ? getInviteStatusBadge(editingMember) : null}
        onClose={() => setEditingMember(null)}
      />

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

      {/* Add Member Dialog */}
      <Dialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
      >
        <DialogContent className={AVATAR_SELECTION_DIALOG_CLASS}>
          <DialogHeader className="shrink-0">
            <DialogTitle>{TEAM_PANEL_UI_TEXT.addTeamMember}</DialogTitle>
            <DialogDescription>
              {TEAM_PANEL_UI_TEXT.addMemberDescription}
            </DialogDescription>
          </DialogHeader>

          <div className={AVATAR_SELECTION_DIALOG_BODY_CLASS}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_SECTION_SPACING, paddingBottom: PANEL_PADDING }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: PANEL_FIELD_SPACING }}>
              <Label htmlFor="invite-team">{TEAM_PANEL_UI_TEXT.addMemberTargetTeamLabel}</Label>
              <Select
                value={inviteTargetTeamId ?? "workspace"}
                onValueChange={(value) =>
                  setInviteTargetTeamId(value === "workspace" ? null : value)
                }
              >
                <SelectTrigger id="invite-team">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">
                    {TEAM_PANEL_UI_TEXT.workspaceTeam}
                  </SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                      <Icon name="identification-badge" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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
                      <Icon name="identification-badge" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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
              <Label>{AVATAR_UI_TEXT.chooseAvatar}</Label>
              <AvatarSelection
                selectedAvatar={newMemberAvatar}
                onAvatarSelect={setNewMemberAvatar}
                gender={newMemberGender}
                onGenderChange={setNewMemberGender}
                previewSeed={newMemberName.trim() || newMemberEmail.trim() || 'User'}
                scrollable
              />
            </div>
          </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-border/40 pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center sm:w-auto sm:justify-start"
              onClick={() => {
                setShowAddMember(false);
                openBulkInviteDialog();
              }}
              style={{ fontSize: TEAM_PANEL_TEXT_SIZE_SMALL }}
            >
              <Icon name="user-plus" size={TEAM_PANEL_ICON_SIZE_SMALL} style={{ marginRight: TEAM_PANEL_MARGIN_RIGHT_SMALL }} />
              {TEAM_PANEL_UI_TEXT.bulkInvite}
            </Button>
            <div className={AVATAR_SELECTION_DIALOG_FOOTER_CLASS}>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setShowAddMember(false)}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
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
              <Label htmlFor="bulk-invite-team">{TEAM_PANEL_UI_TEXT.addMemberTargetTeamLabel}</Label>
              <Select
                value={inviteTargetTeamId ?? "workspace"}
                onValueChange={(value) =>
                  setInviteTargetTeamId(value === "workspace" ? null : value)
                }
              >
                <SelectTrigger id="bulk-invite-team">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">
                    {TEAM_PANEL_UI_TEXT.workspaceTeam}
                  </SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                      <Icon name="identification-badge" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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
                      <Icon name="identification-badge" size={TEAM_PANEL_ICON_SIZE_MEDIUM} />
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