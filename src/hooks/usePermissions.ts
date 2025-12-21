import { useAuth } from '../contexts/AuthContext';
import { useTeam } from '../contexts/TeamContext';
import { useMemo } from 'react';
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
  const { teamMembers, getTeamMember } = useTeam();

  const permissions = useMemo(() => {
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

    if (!user) {
      return defaultPermissions;
    }

    // Get current user's team member info
    const currentUserMember = getTeamMember(user.id);
    
    // If user is not in team members list, default to admin (workspace owner)
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

  return permissions;
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

