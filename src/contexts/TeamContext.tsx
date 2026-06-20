import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import type { User, Team } from '../types';
import { useAuth } from './AuthContext';
import { useTasks } from './TaskContext';
import * as api from '../lib/api';
import { toast } from 'sonner';
import { DAYS_IN_WEEK } from '../lib/business-constants';
import { createDefaultTeamContext } from '../lib/context-defaults';
import { TEAM_MAX_MEMBERS } from '../lib/layout-constants';
import { TEAM_PANEL_UI_TEXT } from '../lib/team-panel-constants';
import { pickAvatarFromPoolAuto } from '../lib/avatar-utils';

interface TeamContextType {
  // Legacy workspace-based team (for backward compatibility)
  teamMembers: User[];
  isLoading: boolean;
  addTeamMember: (
    member: Omit<User, 'id'>,
    workspaceId: string,
    options?: { silent?: boolean; avatar?: string; skipRefresh?: boolean; batchInviteIndex?: number },
  ) => Promise<void>;
  removeTeamMember: (memberId: string, workspaceId: string) => Promise<void>;
  updateTeamMember: (memberId: string, updates: Partial<User>, workspaceId: string) => Promise<void>;
  getTeamMember: (memberId: string) => User | undefined;
  markMemberAsViewed: (memberId: string) => void;
  acceptInvitation: (memberId: string) => void;
  resendInvitation: (memberId: string, workspaceId: string) => Promise<void>;
  declineInvitation: (memberId: string, workspaceId: string) => Promise<void>;
  syncTeamMembers: (workspaceId: string) => Promise<void>;
  // New multi-team support
  teams: Team[];
  currentTeamId: string | null;
  currentTeamMembers: User[];
  isLoadingTeams: boolean;
  createTeam: (name: string, description?: string, overrideWorkspaceId?: string) => Promise<void>;
  updateTeam: (teamId: string, name: string, description?: string, overrideWorkspaceId?: string) => Promise<void>;
  deleteTeam: (teamId: string, overrideWorkspaceId?: string) => Promise<void>;
  selectTeam: (teamId: string | null) => void;
  syncTeams: (workspaceId: string) => Promise<void>;
  addTeamMemberToTeam: (
    teamId: string,
    member: Omit<User, 'id'>,
    avatar?: string,
    options?: { silent?: boolean; skipRefresh?: boolean; batchInviteIndex?: number },
  ) => Promise<void>;
  removeTeamMemberFromTeam: (teamId: string, memberId: string) => Promise<void>;
  updateTeamMemberInTeam: (teamId: string, memberId: string, updates: Partial<User>) => Promise<void>;
}

export const TeamContext = createContext<TeamContextType | undefined>(undefined);

const STORAGE_KEY = 'taskzm_team_members';

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const { workspaceId } = useTasks();
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // New multi-team state
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [currentTeamMembers, setCurrentTeamMembers] = useState<User[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  // Prevent concurrent sync operations
  const syncTeamsInProgressRef = useRef(false);
  // Track the team ID for which we're currently loading members (prevent stale updates)
  const loadingTeamIdRef = useRef<string | null>(null);

  const syncTeamMembers = useCallback(async (wsId: string) => {
    if (!accessToken) return;
    
    setIsLoading(true);
    try {
      const members = await api.getTeamMembers(wsId);
      
      // Ensure current user is included
      const allMembers = members;
      if (user && !members.find(m => m.id === user.id)) {
        allMembers.push({
          id: user.id,
          email: user.email || '',
          name: user.name || 'You',
          avatar: user.avatar || pickAvatarFromPoolAuto(user.email || user.name || user.id),
          role: 'admin' as const,
          inviteStatus: 'accepted' as const,
        });
      }

      setTeamMembers(allMembers);
      
      // Also save to localStorage as backup
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allMembers));
      } catch (error) {
        console.error('Failed to save team members to localStorage:', error);
      }
    } catch (error) {
      // Silently handle 404s - they're expected for new workspaces
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Only log non-404 errors
      if (!errorMessage.includes('404') && !errorMessage.includes('Not found')) {
        console.error('Failed to sync team members:', error);
      }
      // 404s are expected and handled gracefully - no logging needed
      // Fallback to localStorage if server fails
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setTeamMembers(parsed);
        } else {
          // No stored data and 404 - set empty array
          setTeamMembers([]);
        }
      } catch (e) {
        // Silently ignore localStorage parse errors
        console.debug('Failed to load from localStorage:', e);
        setTeamMembers([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, accessToken]);

  // Sync team members from server when user/workspace changes
  useEffect(() => {
    if (user && accessToken && workspaceId) {
      syncTeamMembers(workspaceId);
    }
  }, [user, accessToken, workspaceId, syncTeamMembers]);

  const removeTeamMember = useCallback(async (memberId: string, wsId: string) => {
    if (!accessToken || !wsId) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotRemoveNoWorkspaceAccess);
      return;
    }

    try {
      // Remove from server
      await api.removeTeamMember(wsId, memberId);
      
      // Remove from local state
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
      
      toast.success(TEAM_PANEL_UI_TEXT.teamMemberRemoved);
      
      // Sync to get updated list
      await syncTeamMembers(wsId);
    } catch (error) {
      console.error('Failed to remove team member:', error);
      toast.error(error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToRemoveTeamMember);
    }
  }, [accessToken, syncTeamMembers]);

  const updateTeamMember = useCallback(async (memberId: string, updates: Partial<User>, wsId: string) => {
    if (!accessToken || !wsId) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotUpdateNoWorkspaceAccess);
      return;
    }

    try {
      // Update role on server if role is being changed
      if (updates.role) {
        await api.updateTeamMemberRole(wsId, memberId, updates.role);
      }
      
      // Update local state
      setTeamMembers(prev =>
        prev.map(m => (m.id === memberId ? { ...m, ...updates } : m))
      );
      
      toast.success(TEAM_PANEL_UI_TEXT.teamMemberUpdated);
    } catch (error) {
      console.error('Failed to update team member:', error);
      toast.error(error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToUpdateTeamMember);
    }
  }, [accessToken]);

  const getTeamMember = (memberId: string) => {
    return teamMembers.find(m => m.id === memberId);
  };

  const markMemberAsViewed = (memberId: string) => {
    setTeamMembers(prev =>
      prev.map(m =>
        m.id === memberId
          ? {
              ...m,
              hasUnreadNotification: false,
              lastViewedAt: new Date().toISOString(),
            }
          : m
      )
    );
  };

  const acceptInvitation = (memberId: string) => {
    const now = new Date().toISOString();
    setTeamMembers(prev =>
      prev.map(m =>
        m.id === memberId
          ? {
              ...m,
              inviteStatus: 'accepted',
              hasUnreadNotification: true,
              acceptedAt: now,
            }
          : m
      )
    );
  };

  const resendInvitation = useCallback(async (memberId: string, wsId: string) => {
    if (!accessToken || !wsId) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotResendNoWorkspaceAccess);
      return;
    }

    const member = teamMembers.find(m => m.id === memberId);
    if (!member || !member.invitationToken) {
      toast.error(TEAM_PANEL_UI_TEXT.invitationTokenNotFound);
      return;
    }

    try {
      await api.resendInvitation(wsId, member.invitationToken);
      
      // Update expiration date in local state
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + DAYS_IN_WEEK);
      
      setTeamMembers(prev =>
        prev.map(m =>
          m.id === memberId
            ? {
                ...m,
                expiresAt: newExpiresAt.toISOString(),
                invitedAt: new Date().toISOString(),
              }
            : m
        )
      );
      
      toast.success(TEAM_PANEL_UI_TEXT.invitationResentTo(member.email));
      await syncTeamMembers(wsId);
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      toast.error(error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToResendInvitation);
    }
  }, [accessToken, teamMembers, syncTeamMembers]);

  const declineInvitation = useCallback(async (memberId: string, wsId: string) => {
    if (!accessToken || !wsId) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotDeclineNoWorkspaceAccess);
      return;
    }

    const member = teamMembers.find(m => m.id === memberId);
    if (!member || !member.invitationToken) {
      toast.error(TEAM_PANEL_UI_TEXT.invitationTokenNotFound);
      return;
    }

    try {
      await api.declineInvitation(wsId, member.invitationToken);
      
      // Remove from local state
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
      
      toast.success(TEAM_PANEL_UI_TEXT.invitationDeclined);
      await syncTeamMembers(wsId);
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      toast.error(error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToDeclineInvitation);
    }
  }, [accessToken, teamMembers, syncTeamMembers]);

  // New multi-team functions
  const syncTeams = useCallback(async (wsId: string, preserveSelection: boolean = false) => {
    if (!accessToken || !wsId) return;
    
    // Prevent concurrent sync operations
    if (syncTeamsInProgressRef.current) {
      console.debug('Sync teams already in progress, skipping...');
      return;
    }
    
    syncTeamsInProgressRef.current = true;
    setIsLoadingTeams(true);
    try {
      const fetchedTeams = await api.getTeams(wsId);
      setTeams(fetchedTeams);
      
      // Only auto-select first team if:
      // 1. No team is currently selected
      // 2. Teams exist
      // 3. We're not preserving the current selection (e.g., after creating a new team)
      if (!preserveSelection && !currentTeamId && fetchedTeams.length > 0) {
        setCurrentTeamId(fetchedTeams[0].id);
      }
    } catch (error) {
      console.error('Failed to sync teams:', error);
      setTeams([]);
    } finally {
      setIsLoadingTeams(false);
      syncTeamsInProgressRef.current = false;
    }
  }, [accessToken, currentTeamId]);

  const createTeam = useCallback(async (name: string, description?: string, overrideWorkspaceId?: string) => {
    const wsId = overrideWorkspaceId ?? workspaceId;
    if (!accessToken || !wsId || !user) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotCreateTeamNoAccess);
      return;
    }

    // Check if user is admin (can create teams)
    // If user is not in teamMembers yet, check their role property
    // Default to admin if not explicitly set (workspace owners can create teams)
    const userMember = teamMembers.find(m => m.id === user.id);
    const userRole = userMember?.role || user.role || 'admin';
    
    if (userRole !== 'admin') {
      toast.error(TEAM_PANEL_UI_TEXT.onlyAdminsCanCreateTeams);
      return;
    }

    try {
      const newTeam = await api.createTeam(wsId, name, description);
      // Sync teams from server to get the complete list with all metadata
      // Preserve selection to prevent auto-selection from overriding our new team selection
      await syncTeams(wsId, true);
      // Select the newly created team after sync
      setCurrentTeamId(newTeam.id);
      toast.success(TEAM_PANEL_UI_TEXT.teamCreatedSuccessfully(name));
    } catch (error) {
      console.error('Failed to create team:', error);
      toast.error(error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToCreateTeam);
    }
  }, [accessToken, workspaceId, user, teamMembers, syncTeams]);

  const updateTeam = useCallback(async (teamId: string, name: string, description?: string, overrideWorkspaceId?: string) => {
    const wsId = overrideWorkspaceId ?? workspaceId;
    if (!accessToken || !wsId) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotUpdateTeamNoAccess);
      return;
    }

    if (!name || !name.trim()) {
      toast.error(TEAM_PANEL_UI_TEXT.teamNameRequired);
      return;
    }

    try {
      await api.updateTeam(teamId, name, description);
      // Sync teams to refresh the list
      await syncTeams(wsId);
      toast.success(TEAM_PANEL_UI_TEXT.teamUpdatedSuccessfully(name));
    } catch (error) {
      console.error('Failed to update team:', error);
      toast.error(error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToUpdateTeam);
    }
  }, [accessToken, workspaceId, syncTeams]);

  const deleteTeam = useCallback(async (teamId: string, overrideWorkspaceId?: string) => {
    const wsId = overrideWorkspaceId ?? workspaceId;
    if (!accessToken || !wsId) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotDeleteTeamNoAccess);
      return;
    }

    try {
      await api.deleteTeam(teamId);
      
      // If deleted team was selected, switch to workspace view
      if (currentTeamId === teamId) {
        setCurrentTeamId(null);
        setCurrentTeamMembers([]);
      }
      
      // Sync teams to refresh the list, preserve selection (workspace team is already selected)
      await syncTeams(wsId, true);
      toast.success(TEAM_PANEL_UI_TEXT.teamDeletedSuccessfully);
    } catch (error) {
      console.error('Failed to delete team:', error);
      toast.error(error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToDeleteTeam);
    }
  }, [accessToken, workspaceId, currentTeamId, syncTeams]);

  const selectTeam = useCallback((teamId: string | null) => {
    setCurrentTeamId(teamId);
    // Track which team we're loading members for
    loadingTeamIdRef.current = teamId;
    
    if (teamId) {
      // Load members for selected team
      api.getTeamMembersByTeam(teamId).then(members => {
        // Only update if this is still the selected team (prevent stale updates)
        if (loadingTeamIdRef.current === teamId) {
          setCurrentTeamMembers(members);
        }
      }).catch(error => {
        console.error('Failed to load team members:', error);
        // Only clear if this is still the selected team
        if (loadingTeamIdRef.current === teamId) {
          setCurrentTeamMembers([]);
        }
      });
    } else {
      // Workspace team selected - sync workspace team members
      setCurrentTeamMembers([]);
      // Sync workspace team members if not already loading
      if (workspaceId && accessToken && !isLoading) {
        syncTeamMembers(workspaceId).catch(error => {
          console.error('Failed to sync workspace team members:', error);
        });
      }
    }
  }, [workspaceId, accessToken, syncTeamMembers, isLoading]);

  const sendEmailInvitation = useCallback(async (
    wsId: string,
    member: Omit<User, 'id'>,
    options?: {
      teamId?: string;
      avatar?: string;
      silent?: boolean;
      skipRefresh?: boolean;
      batchInviteIndex?: number;
    },
  ) => {
    if (!accessToken) {
      throw new Error(TEAM_PANEL_UI_TEXT.cannotInviteNoWorkspaceAccess);
    }
    if (!wsId || typeof wsId !== 'string' || wsId.trim() === '' || wsId.includes(':')) {
      throw new Error(TEAM_PANEL_UI_TEXT.invalidWorkspaceId);
    }

    const teamId = options?.teamId;
    const avatar = options?.avatar ?? member.avatar;
    const silent = options?.silent ?? false;
    const skipRefresh = options?.skipRefresh ?? false;
    const batchInviteIndex = options?.batchInviteIndex ?? 0;

    if (teamId) {
      const team = teams.find((t) => t.id === teamId);
      const memberCount =
        Math.max(team?.memberCount ?? 0, currentTeamMembers.length) + batchInviteIndex;
      if (memberCount >= TEAM_MAX_MEMBERS) {
        throw new Error(TEAM_PANEL_UI_TEXT.maxMembersLimit(TEAM_MAX_MEMBERS));
      }
    }

    const notifySuccess = () => {
      if (!silent) {
        toast.success(TEAM_PANEL_UI_TEXT.invitationSentTo(member.email), {
          description: TEAM_PANEL_UI_TEXT.invitationSentDescription,
        });
      }
    };

    const applyPendingInvitation = (invitation: { token: string; expiresAt?: string }) => {
      const now = new Date().toISOString();
      const pendingMember: User = {
        ...member,
        id: `pending_${invitation.token}`,
        inviteStatus: 'pending',
        hasUnreadNotification: false,
        lastViewedAt: null,
        invitedAt: now,
        acceptedAt: null,
        expiresAt: invitation.expiresAt,
        invitationToken: invitation.token,
        teamId,
        avatar: avatar || member.avatar,
      };

      if (teamId) {
        setCurrentTeamMembers((prev) => {
          const withoutDuplicate = prev.filter(
            (m) => m.email.toLowerCase() !== member.email.toLowerCase(),
          );
          return [...withoutDuplicate, pendingMember];
        });
      } else {
        setTeamMembers((prev) => {
          const withoutDuplicate = prev.filter(
            (m) => m.email.toLowerCase() !== member.email.toLowerCase(),
          );
          return [...withoutDuplicate, pendingMember];
        });
      }
    };

    const refreshAfterInvite = async () => {
      if (teamId) {
        await selectTeam(teamId);
        await syncTeams(wsId, true);
      } else {
        await syncTeamMembers(wsId);
      }
    };

    const handleInviteResponse = async (
      result: { member?: User; invitation?: { token: string; expiresAt?: string } },
    ) => {
      if (result.member) {
        notifySuccess();
        if (!skipRefresh) {
          await refreshAfterInvite();
        }
        return;
      }
      const invitation = result.invitation;
      if (invitation?.token) {
        applyPendingInvitation(invitation);
        notifySuccess();
        if (!skipRefresh) {
          await refreshAfterInvite();
        }
        return;
      }
      throw new Error(TEAM_PANEL_UI_TEXT.invalidInvitationResponse);
    };

    try {
      const result = await api.inviteTeamMember(
        wsId,
        member.email,
        member.name,
        member.role || 'member',
        { teamId, avatar },
      );
      await handleInviteResponse(result);
      return;
    } catch (workspaceError) {
      const workspaceMessage = workspaceError instanceof Error ? workspaceError.message : '';
      const alreadyInWorkspace = workspaceMessage.toLowerCase().includes('already a member');

      if (teamId && (alreadyInWorkspace || workspaceMessage.toLowerCase().includes('must have'))) {
        try {
          const teamResult = await api.inviteTeamMemberToTeam(
            teamId,
            member.email,
            member.name,
            member.role || 'member',
            avatar,
          );
          await handleInviteResponse({
            member: teamResult.member,
            invitation: teamResult.invitation ?? (teamResult.token ? teamResult : undefined),
          });
          return;
        } catch (teamError) {
          const teamMessage = teamError instanceof Error ? teamError.message : '';
          const needsEmailInvite =
            teamMessage.toLowerCase().includes('taskzm account') ||
            teamMessage.toLowerCase().includes('must have');
          if (!needsEmailInvite) {
            throw teamError;
          }
        }
      }

      throw workspaceError;
    }
  }, [
    accessToken,
    teams,
    currentTeamMembers.length,
    selectTeam,
    syncTeams,
    syncTeamMembers,
  ]);

  const addTeamMember = useCallback(async (
    member: Omit<User, 'id'>,
    wsId: string,
    options?: { silent?: boolean; avatar?: string; skipRefresh?: boolean; batchInviteIndex?: number },
  ) => {
    try {
      await sendEmailInvitation(wsId, member, {
        avatar: options?.avatar ?? member.avatar,
        silent: options?.silent,
        skipRefresh: options?.skipRefresh,
        batchInviteIndex: options?.batchInviteIndex,
      });
    } catch (error) {
      console.error('Failed to send invitation:', error);
      const errorMessage = error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToSendInvitation;

      if (errorMessage.includes('Workspace not found') || errorMessage.includes('404')) {
        if (!options?.silent) {
          toast.error(TEAM_PANEL_UI_TEXT.workspaceNotFound, {
            description: TEAM_PANEL_UI_TEXT.workspaceNotFoundDescription,
          });
        }
      } else if (!options?.silent) {
        toast.error(errorMessage);
      }

      throw error;
    }
  }, [sendEmailInvitation]);

  const addTeamMemberToTeam = useCallback(async (
    teamId: string,
    member: Omit<User, 'id'>,
    avatar?: string,
    options?: { silent?: boolean; skipRefresh?: boolean; batchInviteIndex?: number },
  ) => {
    if (!accessToken || !teamId) {
      throw new Error(TEAM_PANEL_UI_TEXT.cannotInviteNoTeamAccess);
    }

    const wsId = workspaceId;
    if (!wsId) {
      throw new Error(TEAM_PANEL_UI_TEXT.cannotInviteNoWorkspaceAccess);
    }

    try {
      await sendEmailInvitation(wsId, member, {
        teamId,
        avatar,
        silent: options?.silent,
        skipRefresh: options?.skipRefresh,
        batchInviteIndex: options?.batchInviteIndex,
      });
    } catch (error) {
      console.error('Failed to invite team member:', error);
      if (!options?.silent) {
        const errorMessage = error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToInviteTeamMember;
        toast.error(errorMessage);
      }
      throw error;
    }
  }, [accessToken, workspaceId, sendEmailInvitation]);

  const removeTeamMemberFromTeam = useCallback(async (teamId: string, memberId: string) => {
    if (!accessToken || !teamId) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotRemoveNoTeamAccess);
      return;
    }

    try {
      // TODO: Add API endpoint for removing team member from team
      // await api.removeTeamMemberFromTeam(teamId, memberId);
      setCurrentTeamMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success(TEAM_PANEL_UI_TEXT.teamMemberRemoved);
      // Preserve selection since we're already on this team
      await syncTeams(workspaceId || '', true);
    } catch (error) {
      console.error('Failed to remove team member:', error);
      toast.error(error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToRemoveTeamMember);
    }
  }, [accessToken, workspaceId, syncTeams]);

  const updateTeamMemberInTeam = useCallback(async (teamId: string, memberId: string, updates: Partial<User>) => {
    if (!accessToken || !teamId) {
      toast.error(TEAM_PANEL_UI_TEXT.cannotUpdateNoTeamAccess);
      return;
    }

    try {
      // TODO: Add API endpoint for updating team member in team
      setCurrentTeamMembers(prev =>
        prev.map(m => (m.id === memberId ? { ...m, ...updates } : m))
      );
      toast.success(TEAM_PANEL_UI_TEXT.teamMemberUpdated);
    } catch (error) {
      console.error('Failed to update team member:', error);
      toast.error(error instanceof Error ? error.message : TEAM_PANEL_UI_TEXT.failedToUpdateTeamMember);
    }
  }, [accessToken]);

  // Sync teams when workspace changes
  // Don't auto-select teams on initial load - default to workspace team
  useEffect(() => {
    if (user && accessToken && workspaceId) {
      syncTeams(workspaceId, true); // Preserve selection (don't auto-select first team)
    }
  }, [user, accessToken, workspaceId, syncTeams]);

  // Load members when team is selected (backup for when currentTeamId changes externally)
  useEffect(() => {
    if (currentTeamId && accessToken) {
      // Update loading ref to match current selection
      loadingTeamIdRef.current = currentTeamId;
      api.getTeamMembersByTeam(currentTeamId).then(members => {
        // Only update if this is still the selected team (prevent stale updates)
        if (loadingTeamIdRef.current === currentTeamId) {
          setCurrentTeamMembers(members);
        }
      }).catch(error => {
        console.error('Failed to load team members:', error);
        // Only clear if this is still the selected team
        if (loadingTeamIdRef.current === currentTeamId) {
          setCurrentTeamMembers([]);
        }
      });
    } else if (!currentTeamId) {
      // Workspace team selected - clear current team members
      // Don't sync teamMembers here - selectTeam already handles it
      // This prevents double syncing
      loadingTeamIdRef.current = null;
      setCurrentTeamMembers([]);
      // Ensure workspace team members are synced (only if not already syncing)
      if (workspaceId && accessToken && !isLoading) {
        syncTeamMembers(workspaceId).catch(error => {
          console.error('Failed to sync workspace team members:', error);
        });
      }
    }
  }, [currentTeamId, accessToken, workspaceId, isLoading, syncTeamMembers]);

  return (
    <TeamContext.Provider
      value={{
        // Legacy workspace-based team
        teamMembers,
        isLoading,
        addTeamMember,
        removeTeamMember,
        updateTeamMember,
        getTeamMember,
        markMemberAsViewed,
        acceptInvitation,
        resendInvitation,
        declineInvitation,
        syncTeamMembers,
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
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) {
    // During React Fast Refresh (HMR) or edge cases, providers can temporarily unmount
    // Always return a safe default instead of throwing to prevent crashes
    // This ensures the app continues to work even if the provider isn't available yet
    if (import.meta.env.DEV) {
      console.warn('useTeam called outside TeamProvider (likely HMR issue), returning default');
    }
    return createDefaultTeamContext();
  }
  return context;
}
