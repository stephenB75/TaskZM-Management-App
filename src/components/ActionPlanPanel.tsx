/**
 * ActionPlanPanel Component
 * 
 * Displays AI-generated action plan breakdown with steps, estimated times,
 * and suggested subtasks for a task.
 */

import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import type { ActionPlan, ActionPlanStep } from '../lib/action-plan-generator';
import type { DescriptionAnalysis } from '../lib/description-analyzer';
import type { Domain } from '../lib/domain-terminology';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';

interface ActionPlanPanelProps {
  actionPlan: ActionPlan | null;
  descriptionAnalysis: DescriptionAnalysis | null;
  estimatedMinutes: number;
  estimatedHours: number;
  effortScore: number;
  primaryVerb: string;
  domain: Domain;
  confidence: number;
  isLoading?: boolean;
  onAcceptSuggestion?: (suggestion: string) => void;
  className?: string;
}

const DOMAIN_COLORS: Record<Domain, { bg: string; text: string; border: string }> = {
  business: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  home: {
    bg: 'bg-green-50 dark:bg-green-950/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  personal: {
    bg: 'bg-purple-50 dark:bg-purple-950/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  world: {
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
  },
  mixed: {
    bg: 'bg-gray-50 dark:bg-gray-950/20',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-800',
  },
};

const CATEGORY_ICONS: Record<ActionPlanStep['category'], string> = {
  preparation: '📋',
  execution: '⚡',
  'follow-up': '✅',
};

export function ActionPlanPanel({
  actionPlan,
  descriptionAnalysis,
  estimatedMinutes,
  estimatedHours,
  effortScore,
  primaryVerb,
  domain,
  confidence,
  isLoading = false,
  onAcceptSuggestion,
  className,
}: ActionPlanPanelProps) {
  const domainColors = DOMAIN_COLORS[domain] || DOMAIN_COLORS.personal;

  if (isLoading) {
    return (
      <Card className={cn('p-4 border-2 border-primary/30', className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Analyzing task breakdown...</span>
        </div>
      </Card>
    );
  }

  if (!actionPlan && !descriptionAnalysis) {
    return null;
  }

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <Card className={cn('p-4 border-2 border-primary/30 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">AI Task Breakdown</h3>
        </div>
        <Badge
          variant="outline"
          className={cn(domainColors.bg, domainColors.text, domainColors.border)}
        >
          {domain.charAt(0).toUpperCase() + domain.slice(1)}
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground">Est. Time</div>
          <div className="font-semibold text-sm">{formatTime(estimatedMinutes)}</div>
        </div>
        <div className="text-center p-2 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground">Effort</div>
          <div className="font-semibold text-sm">{effortScore.toFixed(1)}/5</div>
        </div>
        <div className="text-center p-2 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground">Verb</div>
          <div className="font-semibold text-sm capitalize">{primaryVerb}</div>
        </div>
      </div>

      {/* Action Plan Steps */}
      {actionPlan && actionPlan.steps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            Action Plan
          </h4>
          <ScrollArea className="max-h-48">
            <div className="space-y-2 pr-2">
              {actionPlan.steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {step.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{CATEGORY_ICONS[step.category]}</span>
                      <span className="text-sm font-medium text-foreground">{step.action}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(step.estimatedMinutes)}</span>
                      {step.dependencies && step.dependencies.length > 0 && (
                        <span className="text-xs">• Depends on step {step.dependencies[0]}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
          <div className="text-xs text-muted-foreground pt-1">
            Total: {formatTime(actionPlan.totalEstimatedMinutes)}
          </div>
        </div>
      )}

      {/* Suggested Subtasks */}
      {actionPlan && actionPlan.suggestedSubtasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Suggested Subtasks</h4>
          <div className="flex flex-wrap gap-2">
            {actionPlan.suggestedSubtasks.map((subtask, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => onAcceptSuggestion?.(subtask)}
              >
                {subtask}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Description Suggestions */}
      {descriptionAnalysis && descriptionAnalysis.suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Description Suggestions</h4>
          <ul className="space-y-1">
            {descriptionAnalysis.suggestions.map((suggestion, index) => (
              <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence Indicator */}
      {confidence < 0.5 && (
        <div className="text-xs text-muted-foreground italic">
          Low confidence analysis - consider adding more details to improve accuracy
        </div>
      )}
    </Card>
  );
}

