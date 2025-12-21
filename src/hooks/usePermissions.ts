import { useAuth } from '../contexts/AuthContext';
import { TeamContext } from '../contexts/TeamContext';
import { useContext, useMemo } from 'react';
import { toast } from 'sonner';

export type UserRole = 'admin' | 'member' | 'viewer';

export interface Permissions {
  canCreateTask: boolean;
  canEditTask: boolean;
  canDeleteTask: boolean;
  canAssignTask: boolean;
  canManageTeam: boolean;
  canViewAnalytics: boolean;
  role: UserRole;
}

/**
 * Hook to get current user's permissions based on their team role
 */
export function usePermissions(): Permissions {
  const { user } = useAuth();
  
  // Safely get team context - handle case where TeamProvider might not be available yet
  const teamContext = useContext(TeamContext);
  const teamMembers = teamContext?.teamMembers || [];
  const getTeamMember = teamContext?.getTeamMember || null;

  // Default permissions (if not in a team or role not found)
  const defaultPermissions: Permissions = {
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: true,
    canAssignTask: true,
    canManageTeam: true,
    canViewAnalytics: true,
    role: 'admin',
  };

  const permissions = useMemo(() => {
    if (!user) {
      return defaultPermissions;
    }

    // Get current user's team member info (only if getTeamMember is available)
    const currentUserMember = getTeamMember ? getTeamMember(user.id) : undefined;
    
    // If user is not in team members list or TeamProvider not available, default to admin (workspace owner)
    if (!currentUserMember) {
      return defaultPermissions;
    }

    const role = currentUserMember.role || 'member';

    // Define permissions based on role
    switch (role) {
      case 'admin':
        return {
          canCreateTask: true,
          canEditTask: true,
          canDeleteTask: true,
          canAssignTask: true,
          canManageTeam: true,
          canViewAnalytics: true,
          role: 'admin',
        };
      
      case 'member':
        return {
          canCreateTask: true,
          canEditTask: true,
          canDeleteTask: true,
          canAssignTask: true,
          canManageTeam: false,
          canViewAnalytics: true,
          role: 'member',
        };
      
      case 'viewer':
        return {
          canCreateTask: false,
          canEditTask: false,
          canDeleteTask: false,
          canAssignTask: false,
          canManageTeam: false,
          canViewAnalytics: true, // Viewers can still view analytics
          role: 'viewer',
        };
      
      default:
        return defaultPermissions;
    }
  }, [user, teamMembers, getTeamMember]);

  // Always return a valid permissions object, even if useMemo hasn't run yet
  return permissions || defaultPermissions;
}

/**
 * Hook to check if user has permission for a specific action
 * Shows toast error if permission denied
 */
export function usePermissionCheck() {
  const permissions = usePermissions();

  const checkPermission = (
    action: keyof Omit<Permissions, 'role'>,
    actionName: string = action
  ): boolean => {
    if (!permissions[action]) {
      const roleName = permissions.role === 'viewer' ? 'Viewer' : permissions.role === 'member' ? 'Member' : 'Admin';
      toast.error('Permission Denied', {
        description: `${roleName} role does not have permission to ${actionName}. Please contact an admin.`,
      });
      return false;
    }
    return true;
  };

  return {
    permissions,
    checkPermission,
  };
}

