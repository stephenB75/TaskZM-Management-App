import React, { useState, useMemo } from "react";
import {
  Users,
  Mail,
  Shield,
  ShieldCheck,
  Eye,
  UserPlus,
  MoreVertical,
  Trash2,
  Edit2,
  X,
  Bell,
  Clock,
  Search,
  Send,
  XCircle,
  Calendar,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { AppHeader } from "./AppHeader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
// Avatar imports removed - using initials badge instead
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
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
import { toast } from "sonner";
import { cn } from "../lib/utils";
import type { User } from "../types";

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
    switch (role) {
      case "admin":
        return <ShieldCheck className="w-4 h-4" />;
      case "member":
        return <Shield className="w-4 h-4" />;
      case "viewer":
        return <Eye className="w-4 h-4" />;
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
          className={cn(
            "text-xs",
            expiration?.isExpired
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          )}
        >
          <Clock className="w-3 h-3 mr-1" />
          {expiration?.isExpired ? "Expired" : "Pending"}
        </Badge>
      );
    }
    if (member.inviteStatus === "declined") {
      return (
        <Badge
          variant="outline"
          className="text-xs bg-gray-50 text-gray-700 border-gray-200"
        >
          <XCircle className="w-3 h-3 mr-1" />
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          className={cn(
            "group relative overflow-hidden transition-all duration-300",
            "hover:shadow-xl border-2",
            "bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800",
            member.hasUnreadNotification &&
              member.inviteStatus === "accepted" &&
              "ring-2 ring-primary ring-offset-2 bg-primary/5",
            "border-gray-200/60 dark:border-gray-700/60 hover:border-primary/30"
          )}
          onClick={() => {
            if (!dropdownOpen) {
              onCardClick(member);
            }
          }}
        >
          {/* Role-based accent bar */}
          <div 
            className={cn(
              "absolute top-0 left-0 right-0 h-1.5 transition-all duration-300",
              member.role === "admin" && "bg-gradient-to-r from-purple-500 to-pink-500",
              member.role === "member" && "bg-gradient-to-r from-blue-500 to-cyan-500",
              member.role === "viewer" && "bg-gradient-to-r from-gray-400 to-gray-500",
            )}
          />
          
          {/* Notification Badge */}
          {member.hasUnreadNotification &&
            member.inviteStatus === "accepted" && (
              <div className="absolute -top-1 -right-1 z-20">
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg animate-pulse">
                    <Bell className="w-3.5 h-3.5 text-primary-foreground fill-primary-foreground" />
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-ping" />
                </div>
              </div>
            )}
          
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              {/* Enhanced Avatar with gradient */}
              <div className="relative flex-shrink-0">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center",
                  "bg-gradient-to-br from-[#E6D5F0] via-[#C9E4F7] to-[#B8E6D5]",
                  "border-2 shadow-lg transition-transform duration-300",
                  "group-hover:scale-110 group-hover:rotate-3",
                  member.role === "admin" && "border-purple-300 dark:border-purple-700",
                  member.role === "member" && "border-blue-300 dark:border-blue-700",
                  member.role === "viewer" && "border-gray-300 dark:border-gray-700"
                )}>
                  <span className="text-lg font-bold text-primary">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                </div>
                {member.hasUnreadNotification &&
                  member.inviteStatus === "accepted" && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white shadow-md" />
                  )}
              </div>

              {/* Enhanced Info Section */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                        {member.name}
                        {isCurrentUser && (
                          <span className="text-xs font-normal text-muted-foreground ml-1.5">
                            (You)
                          </span>
                        )}
                      </h3>
                    </div>
                    
                    {/* Role and Status Badges */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge
                        variant={getRoleBadgeVariant(member.role)}
                        className={cn(
                          "text-xs font-semibold px-2.5 py-0.5",
                          member.role === "admin" && "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
                          member.role === "member" && "bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900 dark:to-cyan-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
                          member.role === "viewer" && "bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                        )}
                      >
                        {getRoleIcon(member.role)}
                        <span className="ml-1 capitalize">
                          {member.role}
                        </span>
                      </Badge>
                      {getInviteStatusBadge(member)}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {member.email}
                  </span>
                </div>

                {/* Expiration Date */}
                {member.inviteStatus === "pending" && member.expiresAt && (
                  <div className="flex items-center gap-1.5 text-xs mb-3">
                    <Calendar className={cn(
                      "w-3.5 h-3.5 flex-shrink-0",
                      formatExpirationDate(member.expiresAt)?.isExpired 
                        ? "text-red-500" 
                        : "text-amber-500"
                    )} />
                    <span className={cn(
                      formatExpirationDate(member.expiresAt)?.isExpired 
                        ? "text-red-600 dark:text-red-400 font-semibold" 
                        : "text-amber-600 dark:text-amber-400"
                    )}>
                      {formatExpirationDate(member.expiresAt)?.text}
                    </span>
                  </div>
                )}

                {/* Enhanced Task Stats */}
                {stats.total > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <Badge 
                      variant="outline" 
                      className="text-xs font-semibold px-2.5 py-1 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      <span className="font-bold mr-1">{stats.total}</span>
                      {stats.total === 1 ? "task" : "tasks"}
                    </Badge>
                    {stats.completed > 0 && (
                      <Badge 
                        variant="outline" 
                        className="text-xs font-semibold px-2.5 py-1 bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700"
                      >
                        <span className="font-bold mr-1">{stats.completed}</span>
                        done
                      </Badge>
                    )}
                    {stats.inProgress > 0 && (
                      <Badge 
                        variant="outline" 
                        className="text-xs font-semibold px-2.5 py-1 bg-gradient-to-r from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                      >
                        <span className="font-bold mr-1">{stats.inProgress}</span>
                        active
                      </Badge>
                    )}
                    {stats.todo > 0 && (
                      <Badge 
                        variant="outline" 
                        className="text-xs font-semibold px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                      >
                        <span className="font-bold mr-1">{stats.todo}</span>
                        todo
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Enhanced Actions Menu */}
              <div 
                className="relative z-50"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
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
                      className="h-9 w-9 rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end"
                    className="z-[9999] w-48"
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
                            }, 150);
                          }}
                          className="cursor-pointer"
                        >
                          <Send className="w-4 h-4 mr-2" />
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
                            }, 150);
                          }}
                          className="cursor-pointer"
                        >
                          <Bell className="w-4 h-4 mr-2" />
                          Accept Invite (Demo)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setDropdownOpen(false);
                            setTimeout(() => {
                              onDeclineInvitation(member);
                            }, 150);
                          }}
                          className="text-destructive focus:text-destructive cursor-pointer"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Decline Invitation
                        </DropdownMenuItem>
                        <Separator className="my-1" />
                      </>
                    )}
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onUpdateRole(member, "admin");
                        }, 150);
                      }}
                      disabled={member.role === "admin"}
                      className="cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Make Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onUpdateRole(member, "member");
                        }, 150);
                      }}
                      disabled={member.role === "member"}
                      className="cursor-pointer"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Make Member
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onUpdateRole(member, "viewer");
                        }, 150);
                      }}
                      disabled={member.role === "viewer"}
                      className="cursor-pointer"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Make Viewer
                    </DropdownMenuItem>
                    <Separator className="my-1" />
                    <DropdownMenuItem
                      onSelect={() => {
                        setDropdownOpen(false);
                        setTimeout(() => {
                          onRemoveMember(member);
                        }, 150);
                      }}
                      className="text-destructive focus:text-destructive cursor-pointer"
                      disabled={isCurrentUser}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <AppHeader
        title="Team"
        panelOpen={true}
        description={
          teamMembers.length === 0
            ? "Invite your first team member"
            : `${filteredMembers.length} of ${teamMembers.length} member${teamMembers.length === 1 ? "" : "s"}`
        }
        actions={
          <div className="flex items-center gap-2">
            {teamMembers.length > 0 && (
              <Button
                onClick={() => setShowBulkInvite(true)}
                variant="outline"
                size="sm"
                className="hidden sm:flex"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Bulk Invite
              </Button>
            )}
            <Button
              onClick={() => setShowAddMember(true)}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
              size="sm"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Add Member</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        }
        hideDesktopLogo
      />
      {/* Spacer for fixed header on mobile */}
      <div className="md:hidden h-[64px]" />

      {/* Search Bar */}
      <div className="px-4 py-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search members by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Team Members List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3 pb-safe md:pb-4">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground mb-1">
                {searchQuery ? "No members match your search" : "No team members yet"}
              </p>
              {!searchQuery && (
                <>
                  <p className="text-xs text-muted-foreground mb-4">
                    Invite family members or teammates to collaborate
                  </p>
                  <Button
                    onClick={() => setShowAddMember(true)}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add your first member
                  </Button>
                </>
              )}
            </div>
          ) : (
            filteredMembers.map((member) => {
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
            })
          )}
        </div>
      </ScrollArea>

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

          <div className="space-y-4 py-4">
            <div className="space-y-2">
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

            <div className="space-y-2">
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

            <div className="space-y-2">
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
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      <div>
                        <div>Admin</div>
                        <div className="text-xs text-muted-foreground">
                          Full access
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <div>
                        <div>Member</div>
                        <div className="text-xs text-muted-foreground">
                          Can edit tasks
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <div>
                        <div>Viewer</div>
                        <div className="text-xs text-muted-foreground">
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
              className="text-xs"
            >
              <UserPlus className="w-3 h-3 mr-1" />
              Bulk Invite
            </Button>
            <div className="flex gap-2">
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

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-emails">Email Addresses *</Label>
              <textarea
                id="bulk-emails"
                value={bulkInvites}
                onChange={(e) => setBulkInvites(e.target.value)}
                placeholder="john@example.com&#10;jane@example.com&#10;bob@example.com"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                One email per line or comma-separated. Names will be auto-generated from emails.
              </p>
            </div>

            <div className="space-y-2">
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
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      <div>
                        <div>Admin</div>
                        <div className="text-xs text-muted-foreground">
                          Full access
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <div>
                        <div>Member</div>
                        <div className="text-xs text-muted-foreground">
                          Can edit tasks
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <div>
                        <div>Viewer</div>
                        <div className="text-xs text-muted-foreground">
                          Read-only access
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Inviting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
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