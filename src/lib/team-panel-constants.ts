/**
 * Team Panel UI Text Constants
 * Centralized text strings for team panel components
 */

export const TEAM_PANEL_UI_TEXT = {
  roles: {
    admin: 'Admin',
    member: 'Member',
    viewer: 'Viewer',
  },
  currentUser: '(You)',
  bulkInvite: 'Bulk Invite',
  createTeam: 'Create Team',
  teamName: 'Team Name',
  teamDescription: 'Description (optional)',
  createNewTeam: 'Create New Team',
  selectTeam: 'Select Team',
  noTeams: 'No teams yet',
  createFirstTeam: 'Create your first team',
  teamMembers: 'team members',
  teamMember: 'team member',
  maxMembersReached: 'Maximum team members reached',
  maxMembersLimit: (max: number) => `Maximum of ${max} members per team`,
  createTeamDescription: (max: number) => `Create a new team to organize your team members (max ${max} members per team)`,
  addMember: 'Add Member',
  adding: 'Adding...',
  enterTeamName: 'Enter team name',
  optionalDescription: 'Optional description',
  workspaceTeam: 'Workspace Team',
  bulkInviteMembers: 'Bulk Invite Members',
  addTeamMember: 'Add Team Member',
  searchMembersPlaceholder: 'Search members by name, email, or role...',
  bulkInviteDescription: 'Invite multiple members at once. Enter one email per line or comma-separated.',
  bulkInviteInstructions: 'One email per line or comma-separated. Names will be auto-generated from emails.',
  addMemberDescription: 'Invite a new member to collaborate on tasks',
  emailLabel: 'Email',
  nameLabel: 'Name',
  stats: {
    task: 'task',
    tasks: 'tasks',
    completed: 'completed',
    teamMember: 'team member',
    teamMembers: 'team members',
  },
} as const;
