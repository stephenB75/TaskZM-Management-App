import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { User } from '../types';
import { useAuth } from './AuthContext';
import { useTasks } from './TaskContext';
import * as api from '../lib/api';
import { toast } from 'sonner';
import { DAYS_IN_WEEK } from '../lib/business-constants';
import { createDefaultTeamContext } from '../lib/context-defaults';

interface TeamContextType {
  teamMembers: User[];
  isLoading: boolean;
  addTeamMember: (member: Omit<User, 'id'>, workspaceId: string) => Promise<void>;
  removeTeamMember: (memberId: string, workspaceId: string) => Promise<void>;
  updateTeamMember: (memberId: string, updates: Partial<User>, workspaceId: string) => Promise<void>;
  getTeamMember: (memberId: string) => User | undefined;
  markMemberAsViewed: (memberId: string) => void;
  acceptInvitation: (memberId: string) => void;
  resendInvitation: (memberId: string, workspaceId: string) => Promise<void>;
  declineInvitation: (memberId: string, workspaceId: string) => Promise<void>;
  syncTeamMembers: (workspaceId: string) => Promise<void>;
}

export const TeamContext = createContext<TeamContextType | undefined>(undefined);

const STORAGE_KEY = 'taskzm_team_members';

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const { workspaceId } = useTasks();
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
          avatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || 'You'}`,
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

  const addTeamMember = useCallback(async (member: Omit<User, 'id'>, wsId: string) => {
    if (!accessToken || !wsId) {
      toast.error('Cannot invite: No workspace access');
      return;
    }

    // Validate workspace ID format
    if (!wsId || typeof wsId !== 'string' || wsId.trim() === '' || wsId.includes(':')) {
      toast.error('Invalid workspace ID. Please refresh the page.');
      return;
    }

    try {
      console.log('Inviting team member:', { email: member.email, name: member.name, role: member.role, workspaceId: wsId });
      
      // Send invitation via API
      const invitation = await api.inviteTeamMember(wsId, member.email, member.name, member.role);
      
      console.log('Invitation response:', invitation);
      
      if (!invitation || !invitation.token) {
        throw new Error('Invalid invitation response from server');
      }
      
      // Add to local state as pending
      const now = new Date().toISOString();
      const newMember: User = {
        ...member,
        id: `pending_${invitation.token}`,
        inviteStatus: 'pending',
        hasUnreadNotification: false,
        lastViewedAt: null,
        invitedAt: now,
        acceptedAt: null,
        expiresAt: invitation.expiresAt,
        invitationToken: invitation.token,
      };
      
      setTeamMembers(prev => [...prev, newMember]);
      
      // Sync to refresh the list with server data
      await syncTeamMembers(wsId);
      
      toast.success(`Invitation sent to ${member.email}`, {
        description: 'They will receive an email with instructions to join',
      });
    } catch (error) {
      console.error('Failed to send invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send invitation';
      
      // Provide more helpful error messages
      if (errorMessage.includes('Workspace not found') || errorMessage.includes('404')) {
        toast.error('Workspace not found', {
          description: 'Please refresh the page to reload your workspace.',
        });
      } else {
        toast.error(errorMessage);
      }
      
      throw error; // Re-throw to let the UI handle it
    }
  }, [accessToken, syncTeamMembers]);

  const removeTeamMember = useCallback(async (memberId: string, wsId: string) => {
    if (!accessToken || !wsId) {
      toast.error('Cannot remove: No workspace access');
      return;
    }

    try {
      // Remove from server
      await api.removeTeamMember(wsId, memberId);
      
      // Remove from local state
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
      
      toast.success('Team member removed');
      
      // Sync to get updated list
      await syncTeamMembers(wsId);
    } catch (error) {
      console.error('Failed to remove team member:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove team member');
    }
  }, [accessToken, syncTeamMembers]);

  const updateTeamMember = useCallback(async (memberId: string, updates: Partial<User>, wsId: string) => {
    if (!accessToken || !wsId) {
      toast.error('Cannot update: No workspace access');
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
      
      toast.success('Team member updated');
    } catch (error) {
      console.error('Failed to update team member:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update team member');
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
      toast.error('Cannot resend: No workspace access');
      return;
    }

    const member = teamMembers.find(m => m.id === memberId);
    if (!member || !member.invitationToken) {
      toast.error('Invitation token not found');
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
      
      toast.success(`Invitation resent to ${member.email}`);
      await syncTeamMembers(wsId);
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to resend invitation');
    }
  }, [accessToken, teamMembers, syncTeamMembers]);

  const declineInvitation = useCallback(async (memberId: string, wsId: string) => {
    if (!accessToken || !wsId) {
      toast.error('Cannot decline: No workspace access');
      return;
    }

    const member = teamMembers.find(m => m.id === memberId);
    if (!member || !member.invitationToken) {
      toast.error('Invitation token not found');
      return;
    }

    try {
      await api.declineInvitation(wsId, member.invitationToken);
      
      // Remove from local state
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
      
      toast.success('Invitation declined');
      await syncTeamMembers(wsId);
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to decline invitation');
    }
  }, [accessToken, teamMembers, syncTeamMembers]);

  return (
    <TeamContext.Provider
      value={{
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
