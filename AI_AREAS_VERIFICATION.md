# AI Areas Verification

Confirmation that each AI area is working and providing accurate, correct data to the user. Includes data flow, validation, and one display fix applied.

---

## 1. Task breakdown (useTaskBreakdown)

| Aspect | Status | Details |
|--------|--------|---------|
| **Data source** | OK | `createAIContextSync(title, description)` → `analyzeTaskVerbs` → `analyzeDescription` → `generateActionPlan` → `estimateTaskHours`. Single shared context; no redundant domain/term work. |
| **Input** | OK | `task.title \|\| ''`, `task.description \|\| ''`; empty text returns `breakdown = null`, `isLoading = false`. |
| **Caching** | OK | In-memory cache by `hashText(title + description)`; cache checked before analysis; result and `cacheAIAnalysis` written after success. |
| **Error handling** | OK | Invalid/missing domain → fallback context; `createAIContextSync` catch → minimal fallback; analysis catch → `setError`, `setBreakdown(null)`. |
| **Output** | OK | `TaskBreakdown`: `estimatedMinutes`, `estimatedHours`, `effortScore`, `primaryVerb`, `suggestedCategory`, `actionPlan`, `descriptionAnalysis`, `domain`, `confidence`. All used in TaskDialog and cards. |

**Consumers:** TaskDialog (AI Analysis panel, effort, domain, time, description suggestions, suggested subtasks), DraggableTaskCard (AI Suggestions block from `actionPlan.steps`).

---

## 2. Duration estimation (estimateTaskHours / getTaskMinutes)

| Aspect | Status | Details |
|--------|--------|---------|
| **Priority order** | OK | 1) User-set `task.estimatedTime` (if > 0); 2) If `useCachedAIAnalysis`: cached effort/estimatedMinutes from breakdown; 3) Else: verb analysis + formula. |
| **Formula** | OK | Base × (effort / 2.5) × priority × (complexity / 2.5), verb adjustments, clamped to MIN/MAX_TASK_DURATION_MINUTES, rounded to TIME_ROUNDING_INTERVAL. |
| **Validation** | OK | Invalid task → base duration; invalid effort/complexity/multipliers → defaults; invalid final hours → base duration. |
| **getTaskMinutes** | OK | Wraps `estimateTaskHours`; when `useCachedAIAnalysis` and cache hit with `estimatedMinutes > 0`, returns cached minutes; else returns `Math.round(estimateTaskHours(...) * 60)`. |
| **Cache key** | OK | `getCachedAIAnalysis` / `cacheAIAnalysis` use `(task.title ?? '').trim()` and `(task.description ?? '').trim()` — safe for null/undefined. |

**Consumers:** useTaskBreakdown (writes cache), DraggableTaskCard, TodayAgendaView, TaskDialog, InboxView, useAIScheduler, time-conflict, DragDropContext, task-layout.

---

## 3. Action plan (generateActionPlan)

| Aspect | Status | Details |
|--------|--------|---------|
| **Empty task** | OK | No title/description → single step "Complete task", `ACTION_PLAN_CONFIG.DEFAULT_MINUTES`, `suggestedSubtasks: []`. |
| **With context** | OK | Uses `aiContext.domain`, `domainTerms`, `extractedTerms`; validates domain; builds steps via `generateSteps`, subtasks via `generateSubtasks`. |
| **Total time** | OK | `estimateTaskHours(taskForEstimation)` → `totalMinutes`; steps get distributed time; `totalEstimatedMinutes` = sum or totalMinutes. |
| **Step shape** | OK | `ActionPlanStep`: `action`, `estimatedMinutes`, `order`, `category`; optional `dependencies`. Used by task card AI Suggestions and ActionPlanPanel. |

**Consumers:** useTaskBreakdown (breakdown.actionPlan), DraggableTaskCard (renderAISuggestions from actionPlan.steps), TaskDialog (actionPlan.suggestedSubtasks), ActionPlanPanel.

---

## 4. Description analysis (analyzeDescription)

| Aspect | Status | Details |
|--------|--------|---------|
| **Input** | OK | Empty fullText → returns minimal `DescriptionAnalysis` (empty suggestions, default domain). |
| **With context** | OK | Uses `aiContext` for domain, terms; otherwise detects domain and extracts terms locally. |
| **Output** | OK | `original`, `enhanced`, `suggestions`, `addedContext`, `detectedDomain`, `confidence`, keywords/phrases/verbs/nouns, `complexity`. |

**Consumers:** useTaskBreakdown (breakdown.descriptionAnalysis), TaskDialog (description enhancement suggestions when description exists).

---

## 5. Domain detection (detectDomain)

| Aspect | Status | Details |
|--------|--------|---------|
| **Empty text** | OK | Returns `DEFAULT_TASK_DOMAIN`, default confidence, empty keywords, default matchedTerms. |
| **Output** | OK | `domain`, `confidence`, `keywords`, `matchedTerms` (per-domain scores). Used by ai-context, action-plan-generator, description-analyzer. |

---

## 6. AI context (createAIContextSync)

| Aspect | Status | Details |
|--------|--------|---------|
| **Empty input** | OK | Returns minimal context (default domain, empty terms). |
| **Errors** | OK | `detectDomain` catch → default domain; invalid domain → fallback; ensures valid domain before return. |
| **Sync extraction** | OK | Uses `extractTermsFromTaskName` (no Browser AI) for sync path; combined and enhanced with `validateAndEnhanceTermsWithDictionary`. |

---

## 7. AI cache (cacheAIAnalysis / getCachedAIAnalysis)

| Aspect | Status | Details |
|--------|--------|---------|
| **Write** | OK | useTaskBreakdown calls `cacheAIAnalysis(title, description, effortScore, estimatedMinutes, primaryVerb)` after successful breakdown. |
| **Read** | OK | `getCachedAIAnalysis(task)` used by `estimateTaskHours` and `getTaskMinutes` when `useCachedAIAnalysis: true`. |
| **Key safety** | OK | Both use `(value ?? '').trim()` for title/description so null/undefined do not throw. |
| **Consistency** | OK | Scheduler and other callers using `useCachedAIAnalysis: true` see the same duration as the breakdown that was shown to the user. |

---

## 8. Suggestive phrases (getSuggestivePhrases)

| Aspect | Status | Details |
|--------|--------|---------|
| **Logic** | OK | Empty taskName → empty arrays, default domain; else domain detection, local extraction, enhance, return phrases/keywords/verbs/nouns (sliced), domain. |
| **Errors** | OK | try/catch returns empty result and default domain. |
| **Usage** | Note | Exported from description-generator but **not currently called from any UI component**. Available for future "manual description writing" features. |

---

## 9. TaskDialog – AI Analysis display

| Aspect | Status | Details |
|--------|--------|---------|
| **Domain** | OK | `breakdown.domain` capitalized. |
| **Estimated time** | Fixed | **Was:** `breakdown.estimatedHours}h {breakdown.estimatedMinutes % 60}m` (e.g. 1.5h 30m for 90 min — incorrect). **Now:** `Math.floor(breakdown.estimatedMinutes / 60)}h {breakdown.estimatedMinutes % 60}m` (e.g. 1h 30m). |
| **Effort score** | OK | `breakdown.effortScore` with DISPLAY_DECIMAL_PLACES / DISPLAY_MAX. |
| **Primary verb** | OK | Shown when not UNKNOWN_VERB. |
| **Description suggestions** | OK | `breakdown.descriptionAnalysis.suggestions` (when description exists). |
| **Suggested subtasks** | OK | `breakdown.actionPlan.suggestedSubtasks` (strings); click adds subtask. |

---

## 10. DraggableTaskCard – AI Suggestions

| Aspect | Status | Details |
|--------|--------|---------|
| **Data** | OK | User subtasks (non–ai-step) or `breakdown.actionPlan.steps`; domain colors from `breakdown.domain`. |
| **Placement** | OK | &lt; 30 min → expanded section only; ≥ 30 min or no estimated time → under headline. |
| **Step display** | OK | Step count cap from ACTION_PLAN_CONFIG (1 for short, 3 for normal); total time from actionPlan.totalEstimatedMinutes. |
| **Checkbox** | OK | Toggle completes user subtask or creates/updates task subtask from AI step. |

---

## 11. Scheduler (useAIScheduler) and time-conflict

| Aspect | Status | Details |
|--------|--------|---------|
| **Duration** | OK | Uses `getTaskMinutes(task, { useCachedAIAnalysis: true })` where appropriate so scheduled duration matches breakdown/card. |
| **Conflicts** | OK | time-conflict uses `getTaskMinutes(task)` for duration; consistent with rest of app. |

---

## Summary

- **Task breakdown:** Single pipeline (context → verbs → description analysis → action plan → estimate); cached; errors fall back to safe defaults.
- **Duration:** User-set wins; then cached AI (from breakdown); then formula with validation and clamping.
- **Action plan:** Empty task handled; steps and total time consistent; used on cards and in TaskDialog.
- **Cache:** Keys safe for null/undefined title/description; breakdown and scheduler share same numbers.
- **Display fix:** TaskDialog AI estimated time now derived from `estimatedMinutes` only (e.g. 1h 30m for 90 min).
- **getSuggestivePhrases:** Implemented and safe; not yet wired in UI.

All verified areas are working and providing accurate, correct data; one display bug (estimated time in TaskDialog) was fixed.
