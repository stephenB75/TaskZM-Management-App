# Team Structure and Member Management Overview

## Team Architecture

### Workspace-Based Teams
- Each user has a **primary workspace** (`workspace_{userId}_{timestamp}`)
- Workspaces contain **members** (array of user IDs)
- Each workspace has an **owner** (the user who created it)
- Members can belong to **multiple workspaces** (future feature)

### Team Roles
The system supports three role types:

1. **Admin** (`admin`)
   - Full access to workspace
   - Can invite/remove members
   - Can change member roles
   - Can manage all tasks and settings

2. **Member** (`member`)
   - Can create and edit tasks
   - Can view all workspace data
   - Cannot manage team members
   - Default role for new invitations

3. **Viewer** (`viewer`)
   - Read-only access
   - Can view tasks but cannot edit
   - Cannot manage team members

### Data Storage Structure

**Backend (Deno KV Store):**
```
workspace_{workspaceId}_owner          → userId (string)
workspace_{workspaceId}_members        → JSON array of userIds
workspace_{workspaceId}_member_{userId}_role → 'admin' | 'member' | 'viewer'
workspace_{workspaceId}_invitations    → JSON array of invitation tokens
invitation_{token}                     → JSON invitation object
```

**Invitation Object Structure:**
```typescript
{
  token: string;              // Unique invitation token (UUID)
  workspaceId: string;        // Target workspace ID
  email: string;             // Invitee email (lowercase)
  name: string;              // Invitee name
  role: 'admin' | 'member' | 'viewer';
  invitedBy: string;         // User ID who sent invitation
  createdAt: string;         // ISO timestamp
  expiresAt: string;         // ISO timestamp (7 days from creation)
  status: 'pending' | 'accepted' | 'declined';
  acceptedAt?: string;       // ISO timestamp (if accepted)
  acceptedBy?: string;       // User ID (if accepted)
  declinedAt?: string;       // ISO timestamp (if declined)
}
```

---

## How to Add a Team Member

### Frontend Flow (TeamPanel.tsx)

1. **User clicks "Add Member" button**
   - Opens dialog with form fields:
     - Name (required)
     - Email (required, validated)
     - Role (dropdown: admin/member/viewer, default: member)

2. **Form Validation**
   - Validates email format
   - Checks if email already exists in team
   - Ensures workspace exists (creates if missing)

3. **Invitation Process**
   ```typescript
   // In TeamPanel.tsx - handleAddMember()
   await addTeamMember({
     name: newMemberName.trim(),
     email: newMemberEmail.trim(),
     role: newMemberRole,  // 'admin' | 'member' | 'viewer'
     avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newMemberName}`,
   }, workspaceId);
   ```

4. **Backend Processing** (`TeamContext.tsx`)
   - Calls `api.inviteTeamMember(workspaceId, email, name, role)`
   - Backend creates invitation token
   - Returns invitation with token and expiration date
   - Frontend adds member to local state as "pending"

### Backend Flow (server/index.tsx)

**Endpoint:** `POST /make-server-65e6e67f/team/:workspaceId/invite`

1. **Authentication Check**
   - Verifies user is authenticated
   - Verifies user is a workspace member

2. **Workspace Validation**
   - Checks workspace exists
   - Ensures user has permission to invite

3. **Invitation Creation**
   ```typescript
   // Generate unique token
   const invitationToken = crypto.randomUUID();
   
   // Set expiration (7 days)
   const expiresAt = new Date();
   expiresAt.setDate(expiresAt.getDate() + 7);
   
   // Store invitation
   await kv.set(`invitation_${invitationToken}`, JSON.stringify({
     token: invitationToken,
     workspaceId,
     email: email.toLowerCase(),
     name,
     role: role || 'member',
     invitedBy: userId,
     createdAt: new Date().toISOString(),
     expiresAt: expiresAt.toISOString(),
     status: 'pending',
   }));
   
   // Track in workspace invitations list
   await kv.set(`workspace_${workspaceId}_invitations`, JSON.stringify([...invitations, invitationToken]));
   ```

4. **Response**
   - Returns invitation object with token
   - Returns invite link: `https://taskzm.com/invite?token={token}`
   - **Note:** Email sending is TODO (currently returns link only)

---

## Invitation Acceptance Flow

### Invite Acceptance Page (`InviteAcceptancePage.tsx`)

1. **User visits invitation link**
   - URL: `https://taskzm.com/invite?token={token}`
   - Component validates token

2. **Token Validation**
   ```typescript
   // Endpoint: POST /team/invitations/validate
   // Checks:
   // - Token exists
   // - Not expired
   // - Status is 'pending'
   ```

3. **Account Check**
   - If user **already exists** (by email):
     - Adds user to workspace immediately
     - Signs them in
   - If user **doesn't exist**:
     - Shows password creation form
     - Creates new account
     - Adds to workspace
     - Signs them in

4. **Acceptance Process**
   ```typescript
   // Endpoint: POST /team/invitations/accept
   // 1. Validates token again
   // 2. Checks if user exists (by email)
   // 3. If new user: Creates account with password
   // 4. Adds user to workspace members array
   // 5. Sets member role
   // 6. Marks invitation as 'accepted'
   ```

---

## Team Member Management

### Viewing Team Members

**Endpoint:** `GET /make-server-65e6e67f/team/:workspaceId/members`

**Returns:**
- All accepted members (with user details from Supabase Auth)
- All pending invitations (with invitation details)
- Member roles
- Invitation status and expiration dates

**Frontend Display:**
- Shows member cards with:
  - Name and email
  - Role badge (Admin/Member/Viewer)
  - Invitation status (Pending/Expired/Declined)
  - Task statistics (if accepted)
  - Action menu (Edit role, Remove, Resend invitation)

### Removing Team Members

**Endpoint:** `DELETE /make-server-65e6e67f/team/:workspaceId/members/:memberId`

**Rules:**
- Only workspace **owner** can remove members
- Cannot remove yourself
- Cannot remove member with assigned tasks (must reassign first)
- Pending invitations can be removed (cancels invitation)

**Process:**
1. Check if member has assigned tasks
2. Remove from workspace members array
3. Delete member role data
4. For pending invitations: Delete invitation token

### Updating Member Roles

**Endpoint:** `PUT /make-server-65e6e67f/team/:workspaceId/members/:memberId/role`

**Rules:**
- Only workspace **owner** can change roles
- Cannot change your own role (must remain admin)
- Cannot update role for pending invitations

**Process:**
1. Verify workspace ownership
2. Verify member exists
3. Update role in KV store: `workspace_{workspaceId}_member_{userId}_role`

### Resending Invitations

**Endpoint:** `POST /make-server-65e6e67f/team/:workspaceId/invitations/resend`

**Process:**
1. Validates invitation exists
2. Generates new expiration date (7 days from now)
3. Updates invitation timestamp
4. Returns new invite link
5. **Note:** Email sending is TODO

---

## Key Components

### Frontend Components

1. **TeamPanel.tsx**
   - Main UI for team management
   - Displays team members list
   - Add member dialog
   - Bulk invite (future feature)
   - Search and filter members
   - Role management UI

2. **InviteAcceptancePage.tsx**
   - Handles invitation acceptance
   - Validates tokens
   - Creates accounts for new users
   - Password creation form

3. **TeamContext.tsx**
   - Manages team state
   - Syncs with backend
   - Handles member operations
   - Caches team data in localStorage

### Backend Endpoints

1. **POST `/team/:workspaceId/invite`**
   - Creates invitation
   - Returns invitation token and link

2. **GET `/team/:workspaceId/members`**
   - Returns all members and pending invitations

3. **DELETE `/team/:workspaceId/members/:memberId`**
   - Removes member or cancels invitation

4. **PUT `/team/:workspaceId/members/:memberId/role`**
   - Updates member role

5. **POST `/team/invitations/validate`**
   - Validates invitation token

6. **POST `/team/invitations/accept`**
   - Accepts invitation
   - Creates account if needed
   - Adds user to workspace

7. **POST `/team/:workspaceId/invitations/resend`**
   - Resends invitation with new expiration

8. **POST `/team/:workspaceId/invitations/decline`**
   - Declines invitation

---

## Current Limitations & TODOs

1. **Email Notifications**
   - ❌ Email sending not implemented
   - Invitation links are returned but not automatically sent
   - TODO: Integrate email service (SendGrid, Resend, etc.)

2. **Bulk Invitations**
   - UI exists but functionality may be incomplete
   - Check `handleBulkInvite` in TeamPanel.tsx

3. **Multiple Workspaces**
   - Users can belong to multiple workspaces
   - Each user has a primary workspace
   - Cross-workspace features may need review

4. **Role Permissions**
   - Role-based permissions may need enhancement
   - Currently: Owner can do everything, others have limited permissions

---

## Security Considerations

1. **Invitation Tokens**
   - Unique UUID tokens
   - 7-day expiration
   - Single-use (status changes to 'accepted' or 'declined')

2. **Access Control**
   - Only workspace members can invite
   - Only workspace owner can remove/change roles
   - Cannot remove yourself or change your own role

3. **Task Assignment Protection**
   - Cannot remove members with assigned tasks
   - Prevents orphaned task assignments

4. **Email Validation**
   - Email is normalized to lowercase
   - Duplicate email checks prevent multiple invitations

---

## Example: Adding a Team Member

### Step-by-Step Flow

1. **User Action:**
   - Navigate to Team Panel
   - Click "Add Member" button
   - Fill form:
     - Name: "John Doe"
     - Email: "john@example.com"
     - Role: "Member"
   - Click "Send Invitation"

2. **Frontend:**
   ```typescript
   // TeamPanel.tsx
   handleAddMember() {
     // Validates form
     // Ensures workspace exists
     await addTeamMember({
       name: "John Doe",
       email: "john@example.com",
       role: "member"
     }, workspaceId);
   }
   ```

3. **Backend:**
   ```typescript
   // server/index.tsx
   POST /team/{workspaceId}/invite {
     // Creates invitation
     token: "abc-123-def-456"
     expiresAt: "2024-12-XX" (7 days)
     status: "pending"
   }
   ```

4. **Invitation Link:**
   - Generated: `https://taskzm.com/invite?token=abc-123-def-456`
   - **Currently:** Returned in response (email not sent)

5. **Invitee Action:**
   - Clicks link or visits URL
   - `InviteAcceptancePage` validates token
   - If new user: Creates account with password
   - If existing user: Adds to workspace
   - Automatically signs in
   - Redirects to dashboard

6. **Result:**
   - User appears in team members list
   - Status changes from "Pending" to "Accepted"
   - User can now access workspace tasks

---

## Testing the Team System

### To Test Adding a Member:

1. **As Workspace Owner:**
   - Go to Team Panel
   - Click "Add Member"
   - Enter test email and name
   - Select role
   - Send invitation

2. **Check Invitation:**
   - Invitation appears in team list as "Pending"
   - Copy invitation link from response (or check backend logs)

3. **Accept Invitation:**
   - Open invitation link in new browser/incognito
   - If new user: Create password
   - If existing user: Sign in
   - Should redirect to dashboard

4. **Verify:**
   - New member appears in team list
   - Status shows "Accepted"
   - Member can access workspace tasks

---

## Code Locations

- **Frontend Team UI:** `src/components/TeamPanel.tsx`
- **Team Context:** `src/contexts/TeamContext.tsx`
- **Invitation Acceptance:** `src/components/InviteAcceptancePage.tsx`
- **API Functions:** `src/lib/api.ts` (inviteTeamMember, getTeamMembers, etc.)
- **Backend Endpoints:** `src/supabase/functions/server/index.tsx` (lines 2835-3402)
- **Types:** `src/types/index.ts` (User interface)

---

## Summary

The team system is **workspace-based** with **invitation-based** member addition. Members are added through an invitation system that:
1. Creates a unique token
2. Stores invitation with 7-day expiration
3. Allows acceptance via link
4. Creates account if needed
5. Adds user to workspace with assigned role

The system supports three roles (admin, member, viewer) with role-based permissions. Currently, email notifications are not implemented, so invitation links must be shared manually.

