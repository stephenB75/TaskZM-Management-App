import React, { useState } from 'react';
import { MoreVertical, Calendar, Clock, CheckCircle2, Circle, AlertCircle, Tag, Users, Sparkles, Link2 } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn, getPriorityColor, formatDate, formatTimeAMPM, isOverdue, calculateProgress, isTaskBlocked, getIncompleteDependencies, getInitials, sanitizeHTML, hasHTMLTags } from '../lib/utils';
import { useTasks } from '../contexts/TaskContext';
import { useTeam } from '../contexts/TeamContext';
import type { Task } from '../types';
import { motion } from 'motion/react';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export function TaskCard({ 
  task, 
  onEdit, 
  onDelete, 
  onStatusChange,
  onDragStart,
  onDragEnd,
  isDragging = false
}: TaskCardProps) {
  const { tasks } = useTasks();
  const { getTeamMember } = useTeam();
  const [isHovered, setIsHovered] = useState(false);
  const progress = calculateProgress(task);
  const overdue = isOverdue(task.dueDate);
  const blocked = isTaskBlocked(task, tasks);
  const incompleteDeps = getIncompleteDependencies(task, tasks);

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(task.id, task.status === 'done' ? 'todo' : 'done');
  };

  const getStatusIcon = () => {
    switch (task.status) {
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'on-hold':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPriorityGradient = () => {
    switch (task.priority) {
      case 'urgent':
        return 'from-red-500 to-pink-500';
      case 'high':
        return 'from-orange-500 to-amber-500';
      case 'medium':
        return 'from-yellow-500 to-amber-500';
      case 'low':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-500 to-slate-500';
    }
  };

  const getPriorityBg = () => {
    switch (task.priority) {
      case 'urgent':
        return 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-red-200 dark:border-red-900';
      case 'high':
        return 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-900';
      case 'medium':
        return 'bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 border-yellow-200 dark:border-yellow-900';
      case 'low':
        return 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-900';
      default:
        return 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          // Responsive padding: smaller on mobile, comfortable on desktop
          'px-3 py-2.5 md:px-4 md:py-4 cursor-pointer transition-all',
          // Responsive borders: thinner on mobile, standard on desktop
          'border border-gray-300/80 md:border-2 md:border-gray-300/90',
          'shadow-lg hover:shadow-xl md:shadow-xl md:hover:shadow-2xl overflow-hidden relative',
          getPriorityBg(),
          isDragging && 'opacity-50 scale-95',
          task.status === 'done' && 'opacity-75'
        )}
        draggable
        onDragStart={(e) => onDragStart?.(e, task)}
        onDragEnd={onDragEnd}
        onClick={() => onEdit(task)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Priority accent bar */}
        <div className={cn('absolute top-0 left-0 right-0 h-1 bg-gradient-to-r', getPriorityGradient())} />
        
        <div className="flex items-start justify-between gap-2 pt-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Checkbox
              checked={task.status === 'done'}
              onCheckedChange={handleToggleComplete}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
          
          <div className="flex-1 min-w-0">
            {/* Scheduled Time with AM/PM - Top Left Corner */}
            {formatTimeAMPM(task.scheduledDate || task.dueDate) && (
              <div className="flex items-center gap-1 mb-1 px-1">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-600">
                  {formatTimeAMPM(task.scheduledDate || task.dueDate)}
                </span>
              </div>
            )}
            
            <h3 className={cn(
              'text-sm mb-1.5 break-words px-1 mt-1',
              task.status === 'done' && 'line-through text-gray-500'
            )}>
              {task.title}
            </h3>
            
            {task.description && (
              <div 
                className={cn(
                  "text-[10px] text-gray-600 dark:text-gray-400 line-clamp-4 break-words mb-3 px-1.5 py-1 mt-0.5",
                  // Rich text formatting styles - only apply if HTML is present
                  // Note: Rich text editor font size changes will override this base size via inline styles
                  hasHTMLTags(task.description) && "[&_strong]:font-bold [&_b]:font-bold",
                  hasHTMLTags(task.description) && "[&_em]:italic [&_i]:italic",
                  hasHTMLTags(task.description) && "[&_u]:underline",
                  hasHTMLTags(task.description) && "[&_s]:line-through [&_strike]:line-through",
                  hasHTMLTags(task.description) && "[&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_mark]:rounded",
                  hasHTMLTags(task.description) && "[&_ul]:list-disc [&_ul]:ml-3 [&_ul]:my-0.5",
                  hasHTMLTags(task.description) && "[&_ol]:list-decimal [&_ol]:ml-3 [&_ol]:my-0.5",
                  hasHTMLTags(task.description) && "[&_li]:ml-1",
                  hasHTMLTags(task.description) && "[&_p]:my-0.5 [&_p]:break-words",
                  hasHTMLTags(task.description) && "[&_code]:bg-gray-100 [&_code]:dark:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono"
                )}
                {...(hasHTMLTags(task.description) 
                  ? { dangerouslySetInnerHTML: { __html: sanitizeHTML(task.description) } }
                  : { children: task.description }
                )}
              />
            )}

            {/* Subtasks Display */}
            {task.subtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {task.subtasks.slice(0, 3).map((subtask) => (
                  <div 
                    key={subtask.id} 
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={cn(
                      'w-3 h-3 rounded-sm border flex-shrink-0',
                      subtask.completed 
                        ? 'bg-primary border-primary' 
                        : 'border-gray-300'
                    )} />
                    <span className={cn(
                      'text-xs leading-tight',
                      subtask.completed 
                        ? 'text-gray-400 line-through' 
                        : 'text-gray-600 dark:text-gray-400'
                    )}>
                      {subtask.title}
                    </span>
                  </div>
                ))}
                {task.subtasks.length > 3 && (
                  <div className="text-xs text-gray-400 pl-5">
                    +{task.subtasks.length - 3} more subtasks
                  </div>
                )}
              </div>
            )}

            {/* Assignee Display */}
            {Array.isArray(task.assignedTo) && task.assignedTo.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                {task.assignedTo.slice(0, 3).map(userId => {
                  const member = getTeamMember(userId);
                  if (!member) return null;
                  
                  const initials = getInitials(member.name);
                  
                  return (
                    <div key={userId} className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 flex items-center justify-center text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                        {initials}
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-semibold">
                        {member.name}
                      </span>
                    </div>
                  );
                })}
                {task.assignedTo.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{task.assignedTo.length - 3} more
                  </span>
                )}
              </div>
            )}

            {task.subtasks && task.subtasks.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>
                    {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length} subtasks
                  </span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1" />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {task.dueDate && (
                <div className={cn(
                  'flex items-center gap-1',
                  overdue && task.status !== 'done' ? 'text-red-600' : 'text-gray-600'
                )}>
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(task.dueDate)}</span>
                </div>
              )}

              {task.estimatedTime && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Clock className="w-3 h-3" />
                  <span>{task.estimatedTime}m</span>
                </div>
              )}

              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-gray-400" />
                  <div className="flex gap-1">
                    {task.tags.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {task.tags.length > 2 && (
                      <span className="text-gray-400">+{task.tags.length - 2}</span>
                    )}
                  </div>
                </div>
              )}

              {task.assignedTo.length > 0 && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Users className="w-3 h-3" />
                  <span>{task.assignedTo.length}</span>
                </div>
              )}

              {task.dependencies && task.dependencies.length > 0 && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Link2 className="w-3 h-3" />
                  <span>{task.dependencies.length}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className={cn(
                'text-xs px-2 py-1 bg-gradient-to-r text-white border-0',
                getPriorityGradient()
              )}>
                {task.priority}
              </Badge>
              {getStatusIcon()}
              
              {/* Blocked indicator */}
              {blocked && (
                <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 bg-amber-50">
                  Blocked ({incompleteDeps.length})
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                'h-8 w-8 p-0 transition-opacity',
                !isHovered && 'opacity-0'
              )}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onStatusChange(task.id, task.status === 'done' ? 'todo' : 'done');
            }}>
              {task.status === 'done' ? 'Mark as Todo' : 'Mark as Done'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="text-red-600"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </Card>
    </motion.div>
  );
}
