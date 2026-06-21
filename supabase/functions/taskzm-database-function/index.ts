import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as calendarSync from "./calendar-sync.tsx";
import * as caldav from "./caldav-client.tsx";
import * as cleanupUtils from "./cleanup-utils.tsx";
import * as emailService from "./email-service.tsx";
import * as appleCaldavSync from "./apple-caldav-sync.tsx";
import * as googleCalendarSync from "./google-calendar-sync.tsx";
import {
  getGoogleOAuthConfig,
  getGoogleOAuthConfigDiagnostics,
  getGoogleRedirectUri,
  mapGoogleTokenExchangeError,
} from "./google-oauth-config.ts";

// ============================================================================
// APP INITIALIZATION
// ============================================================================

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
// Allow all origins to prevent CORS issues
app.use(
  "/*",
  cors({
    origin: "*", // Allow all origins
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    exposeHeaders: ["Content-Length", "Content-Type"],
    maxAge: 86400, // 24 hours
    credentials: false,
  }),
);

// Explicit OPTIONS handler for all routes to ensure preflight requests work
app.options("*", (c) => {
  return c.text("", 204);
});

// ============================================================================
// CONSTANTS
// ============================================================================

// Demo account configuration
const DEMO_CLEANUP_TIMEOUT_MINUTES = 15; // Minutes - Demo accounts are cleaned up after this inactivity period

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const errorObj = error as any;
    if (errorObj.message && typeof errorObj.message === 'string') {
      return errorObj.message;
    }
    if (errorObj.error && typeof errorObj.error === 'string') {
      return errorObj.error;
    }
    try {
      const jsonStr = JSON.stringify(errorObj, Object.getOwnPropertyNames(errorObj));
      if (jsonStr && jsonStr !== '{}') {
        return jsonStr;
      }
    } catch {
      // Ignore stringify errors
    }
  }
  return 'An unexpected error occurred';
}

// Create Supabase client helper
const getSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
};

// Verify user from access token
const verifyUser = async (request: Request) => {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return { userId: null, error: 'No access token provided' };
  }

  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) {
    return { userId: null, error: 'Invalid access token' };
  }

  return { userId: user.id, error: null };
};

// ============================================================================
// SHARED TERMINOLOGY
// ============================================================================

// Terminology configuration constants
const TERMINOLOGY_CONFIG = {
  minKeywordLength: 2,
  minPhraseLength: 3,
  minVerbLength: 2,
  minNounLength: 2,
  maxTermsPerDomain: 1000,
  validDomains: ['business', 'home', 'personal', 'world'] as const,
  validTermTypes: ['keyword', 'phrase', 'verb', 'noun'] as const,
} as const;

// Helper: group raw terminology rows into { keywords, phrases, verbs, nouns }
function groupTerminologyByType(terminology: { term_type: string; term: string }[] | null): {
  keywords: string[];
  phrases: string[];
  verbs: string[];
  nouns: string[];
} {
  const grouped = { keywords: [] as string[], phrases: [] as string[], verbs: [] as string[], nouns: [] as string[] };
  terminology?.forEach(item => {
    if (item.term_type === 'keyword') grouped.keywords.push(item.term);
    else if (item.term_type === 'phrase') grouped.phrases.push(item.term);
    else if (item.term_type === 'verb') grouped.verbs.push(item.term);
    else if (item.term_type === 'noun') grouped.nouns.push(item.term);
  });
  return grouped;
}

// Get shared terminology for ALL domains in one call (reduces Edge invocations from 4 to 1 per cold breakdown)
app.get("/taskzm-database-function/shared-terminology", async (c) => {
  try {
    const supabase = getSupabaseClient();
    const empty = { keywords: [] as string[], phrases: [] as string[], verbs: [] as string[], nouns: [] as string[] };

    const results = await Promise.all(
      TERMINOLOGY_CONFIG.validDomains.map(async (domain) => {
        const { data: terminology, error } = await supabase
          .from('shared_terminology')
          .select('term_type, term, usage_count')
          .eq('domain', domain)
          .order('usage_count', { ascending: false })
          .limit(TERMINOLOGY_CONFIG.maxTermsPerDomain);

        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) return { domain, terminology: empty };
          console.error(`Error fetching shared terminology for ${domain}:`, error);
          return { domain, terminology: empty };
        }
        return { domain, terminology: groupTerminologyByType(terminology) };
      })
    );

    const body: Record<string, { keywords: string[]; phrases: string[]; verbs: string[]; nouns: string[] }> = {};
    results.forEach(({ domain, terminology }) => { body[domain] = terminology; });
    return c.json(body);
  } catch (error) {
    console.error('Error in shared-terminology (all) GET:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get shared terminology for a single domain (kept for backward compatibility)
app.get("/taskzm-database-function/shared-terminology/:domain", async (c) => {
  try {
    const domain = c.req.param('domain');

    if (!TERMINOLOGY_CONFIG.validDomains.includes(domain as any)) {
      return c.json({ error: 'Invalid domain' }, 400);
    }

    const supabase = getSupabaseClient();
    const { data: terminology, error } = await supabase
      .from('shared_terminology')
      .select('term_type, term, usage_count')
      .eq('domain', domain)
      .order('usage_count', { ascending: false })
      .limit(TERMINOLOGY_CONFIG.maxTermsPerDomain);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return c.json({ terminology: groupTerminologyByType(null) });
      }
      console.error('Error fetching shared terminology:', error);
      return c.json({ error: getErrorMessage(error) }, 500);
    }

    return c.json({ terminology: groupTerminologyByType(terminology) });
  } catch (error) {
    console.error('Error in shared-terminology GET:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Save new terminology to shared library
app.post("/taskzm-database-function/shared-terminology", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { domain, keywords = [], phrases = [], verbs = [], nouns = [] } = body;

    // Validate domain
    if (!domain || !TERMINOLOGY_CONFIG.validDomains.includes(domain as any)) {
      return c.json({ error: 'Invalid domain' }, 400);
    }

    const supabase = getSupabaseClient();
    let savedCount = 0;
    let skippedCount = 0;

    // Save keywords
    for (const keyword of keywords) {
      if (!keyword || typeof keyword !== 'string' || keyword.trim().length < TERMINOLOGY_CONFIG.minKeywordLength) {
        skippedCount++;
        continue;
      }
      
      try {
        const { error: upsertError } = await supabase.rpc('upsert_shared_terminology', {
          p_domain: domain,
          p_term_type: 'keyword',
          p_term: keyword.trim(),
          p_user_id: userId,
        });
        
        if (upsertError) {
          // If table doesn't exist, skip silently (table will be created by migration)
          if (upsertError.code === '42P01' || upsertError.message?.includes('does not exist')) {
            console.warn(`shared_terminology table does not exist, skipping keyword "${keyword}"`);
          } else {
            console.warn(`Failed to save keyword "${keyword}":`, upsertError);
          }
          skippedCount++;
        } else {
          savedCount++;
        }
      } catch (err) {
        console.warn(`Error saving keyword "${keyword}":`, err);
        skippedCount++;
      }
    }

    // Save phrases
    for (const phrase of phrases) {
      if (!phrase || typeof phrase !== 'string' || phrase.trim().length < TERMINOLOGY_CONFIG.minPhraseLength) {
        skippedCount++;
        continue;
      }
      
      try {
        const { error: upsertError } = await supabase.rpc('upsert_shared_terminology', {
          p_domain: domain,
          p_term_type: 'phrase',
          p_term: phrase.trim(),
          p_user_id: userId,
        });
        
        if (upsertError) {
          // If table doesn't exist, skip silently (table will be created by migration)
          if (upsertError.code === '42P01' || upsertError.message?.includes('does not exist')) {
            console.warn(`shared_terminology table does not exist, skipping phrase "${phrase}"`);
          } else {
            console.warn(`Failed to save phrase "${phrase}":`, upsertError);
          }
          skippedCount++;
        } else {
          savedCount++;
        }
      } catch (err) {
        console.warn(`Error saving phrase "${phrase}":`, err);
        skippedCount++;
      }
    }

    // Save verbs
    for (const verb of verbs) {
      if (!verb || typeof verb !== 'string' || verb.trim().length < TERMINOLOGY_CONFIG.minVerbLength) {
        skippedCount++;
        continue;
      }
      
      try {
        const { error: upsertError } = await supabase.rpc('upsert_shared_terminology', {
          p_domain: domain,
          p_term_type: 'verb',
          p_term: verb.trim(),
          p_user_id: userId,
        });
        
        if (upsertError) {
          // If table doesn't exist, skip silently (table will be created by migration)
          if (upsertError.code === '42P01' || upsertError.message?.includes('does not exist')) {
            console.warn(`shared_terminology table does not exist, skipping verb "${verb}"`);
          } else {
            console.warn(`Failed to save verb "${verb}":`, upsertError);
          }
          skippedCount++;
        } else {
          savedCount++;
        }
      } catch (err) {
        console.warn(`Error saving verb "${verb}":`, err);
        skippedCount++;
      }
    }

    // Save nouns
    for (const noun of nouns) {
      if (!noun || typeof noun !== 'string' || noun.trim().length < TERMINOLOGY_CONFIG.minNounLength) {
        skippedCount++;
        continue;
      }
      
      try {
        const { error: upsertError } = await supabase.rpc('upsert_shared_terminology', {
          p_domain: domain,
          p_term_type: 'noun',
          p_term: noun.trim(),
          p_user_id: userId,
        });
        
        if (upsertError) {
          // If table doesn't exist, skip silently (table will be created by migration)
          if (upsertError.code === '42P01' || upsertError.message?.includes('does not exist')) {
            console.warn(`shared_terminology table does not exist, skipping noun "${noun}"`);
          } else {
            console.warn(`Failed to save noun "${noun}":`, upsertError);
          }
          skippedCount++;
        } else {
          savedCount++;
        }
      } catch (err) {
        console.warn(`Error saving noun "${noun}":`, err);
        skippedCount++;
      }
    }

    console.log(`✅ Saved ${savedCount} new terms to shared terminology (${skippedCount} skipped)`);

    return c.json({ 
      success: true,
      saved: savedCount,
      skipped: skippedCount,
    });
  } catch (error) {
    console.error('Error in shared-terminology POST:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// SERVER-SIDE AI (DESCRIPTION GENERATION)
// ============================================================================
// All OpenAI config from env (no hardcoded secrets or URLs). See .env.example and Supabase Edge Function secrets.

const AI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OPENAI_CHAT_URL = Deno.env.get('OPENAI_CHAT_URL') || 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
const OPENAI_DESC_MAX_TOKENS = 250;
const OPENAI_DESC_TEMPERATURE = 0.3;
const OPENAI_OPTS_MAX_TOKENS = 600;
const OPENAI_OPTS_TEMPERATURE = 0.4;
const OPENAI_ACTION_PLAN_MAX_TOKENS = 400;
const OPENAI_ACTION_PLAN_TEMPERATURE = 0.4;
const AI_DESC_CONFIDENCE_DEFAULT = 0.85;
const AI_OPTS_CONFIDENCE_DEFAULT = 0.75;

/** Words that must not appear in description/action plan unless they appear in the task name (avoids off-topic drift). */
const DESC_AND_PLAN_FORBIDDEN_UNLESS_IN_TASK = [
  'milestone', 'customer', 'forecast', 'report', 'deliverable', 'proposal', 'test (as in testing)',
  'workout', 'fitness', 'gym', 'exercise', 'notifications', 're-occurring',
];

/** High-risk cross-context terms to forbid per domain (reduces jumbling). */
const DO_NOT_USE_TERMS: Record<string, string[]> = {
  business: ['anniversary', 'banquet', 'celebration', 'birthday party', 'wedding', 'holiday party', 'family dinner', 'vacation', 'personal time'],
  home: ['meeting', 'deadline', 'presentation', 'report', 'client', 'stakeholder', 'office', 'corporate'],
  personal: ['anniversary', 'banquet', 'celebration', 'birthday party', 'wedding', 'holiday party', 'code', 'codebase', 'software', 'api', 'debug', 'deployment', 'pull request', 'repository'],
  world: ['anniversary', 'banquet', 'celebration', 'workout', 'gym', 'exercise'],
  mixed: [],
};

/** Max length for task name in situation (avoid huge payloads; do not truncate below this). */
const TASK_NAME_MAX_LEN = 500;

/**
 * Build situation line with task name as explicit user input. Task name is not truncated
 * (capped at TASK_NAME_MAX_LEN for safety). Optional steps are appended when provided.
 */
function buildSituationLine(taskName: string, actionPlanSteps: string[], _maxLen?: number): string {
  const safeTaskName = taskName.length > TASK_NAME_MAX_LEN ? taskName.slice(0, TASK_NAME_MAX_LEN) + '...' : taskName;
  let s = `Task name (the specific task the user wants to accomplish): ${safeTaskName}`;
  if (actionPlanSteps.length > 0) {
    s += `\nExisting steps (if any): ${actionPlanSteps.slice(0, 5).join(', ')}.`;
  }
  return s;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Filter terminology to terms that appear in or share a word with the task name (reduces off-topic drift). */
function filterTerminologyToTask(
  taskName: string,
  terminology: { keywords: string[]; phrases: string[]; verbs: string[]; nouns: string[] }
): { keywords: string[]; phrases: string[]; verbs: string[]; nouns: string[] } {
  const taskLower = taskName.toLowerCase();
  const taskWords = taskLower.split(/\W+/).filter((w) => w.length >= 2);
  const relatesToTask = (term: string): boolean => {
    const t = term.toLowerCase();
    if (taskLower.includes(t)) return true;
    const termWords = t.split(/\W+/).filter((w) => w.length >= 2);
    return termWords.some((pw) => taskWords.some((tw) => tw.includes(pw) || pw.includes(tw)));
  };
  return {
    keywords: (terminology.keywords || []).filter(relatesToTask),
    phrases: (terminology.phrases || []).filter(relatesToTask),
    verbs: (terminology.verbs || []).filter(relatesToTask),
    nouns: (terminology.nouns || []).filter(relatesToTask),
  };
}

// GET /taskzm-database-function/ai/status — check if OpenAI is configured (no auth; returns configured only)
app.get("/taskzm-database-function/ai/status", (c) => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const configured = !!(apiKey && apiKey.trim().length > 0);
  return c.json({ configured });
});

// POST /taskzm-database-function/ai/description — DEPRECATED: descriptions are generated locally; endpoint kept for compatibility
app.post("/taskzm-database-function/ai/description", (c) => c.json({ error: 'Deprecated: descriptions are generated locally. This endpoint is no longer used.' }, 410));

// POST /taskzm-database-function/ai/description-options — DEPRECATED: description options are generated locally
app.post("/taskzm-database-function/ai/description-options", (c) => c.json({ error: 'Deprecated: description options are generated locally. This endpoint is no longer used.' }, 410));

// POST /taskzm-database-function/ai/action-plan — DEPRECATED: action plans are generated locally
app.post("/taskzm-database-function/ai/action-plan", (c) => c.json({ error: 'Deprecated: action plans are generated locally. This endpoint is no longer used.' }, 410));

// Verify admin user from access token
const verifyAdmin = async (request: Request) => {
  const { userId, error } = await verifyUser(request);
  
  if (error || !userId) {
    return { userId: null, error: error || 'Unauthorized' };
  }

  // Check if user has admin role in KV store
  const role = await kv.get(`user_${userId}_role`);
  
  if (role !== 'admin') {
    return { userId: null, error: 'Admin access required' };
  }

  return { userId, error: null };
};

// Helper function to get and parse workspace members
async function getWorkspaceMembers(workspaceId: string): Promise<string[]> {
  try {
    let members = await kv.get(`workspace_${workspaceId}_members`);

    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (e) {
        console.log('Error parsing members, initializing with owner:', e);
        const owner = await kv.get(`workspace_${workspaceId}_owner`);
        if (owner) {
          members = [String(owner)];
          await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(members));
        } else {
          members = [];
        }
      }
    }

    if (!members || !Array.isArray(members)) {
      const owner = await kv.get(`workspace_${workspaceId}_owner`);
      if (owner) {
        members = [String(owner)];
        await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(members));
      } else {
        members = [];
      }
    }

    return Array.isArray(members) ? members : [];
  } catch (e) {
    console.log('getWorkspaceMembers error, returning empty list:', e);
    return [];
  }
}

const INVITATION_EXPIRY_DAYS = 7;

async function findUserByEmail(
  supabase: ReturnType<typeof getSupabaseClient>,
  email: string,
) {
  const normalized = email.toLowerCase().trim();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.log('findUserByEmail listUsers error:', error);
      return null;
    }
    const found = data?.users?.find((u) => u.email?.toLowerCase() === normalized);
    if (found) return found;
    if (!data?.users?.length || data.users.length < perPage) break;
    page++;
  }
  return null;
}

async function assertWorkspaceMemberOrOwner(
  workspaceId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
  if (!workspaceOwner) {
    return { ok: false, status: 404, error: 'Workspace not found' };
  }
  const members = await getWorkspaceMembers(workspaceId);
  if (members.includes(userId) || workspaceOwner === userId) {
    return { ok: true };
  }
  return { ok: false, status: 403, error: 'Unauthorized: Not a workspace member' };
}

async function assertWorkspaceAdminOrOwner(
  workspaceId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
  if (!workspaceOwner) {
    return { ok: false, status: 404, error: 'Workspace not found' };
  }
  if (workspaceOwner === userId) {
    return { ok: true };
  }
  const members = await getWorkspaceMembers(workspaceId);
  if (!members.includes(userId)) {
    return { ok: false, status: 403, error: 'Unauthorized: Not a workspace member' };
  }
  const role = await kv.get(`workspace_${workspaceId}_member_${userId}_role`);
  if (role === 'admin') {
    return { ok: true };
  }
  return { ok: false, status: 403, error: 'Unauthorized: Admin access required' };
}

async function cancelPendingInvitation(workspaceId: string, token: string) {
  await kv.del(`invitation_${token}`);
  const invitationTokensStr = await kv.get(`workspace_${workspaceId}_invitations`);
  if (invitationTokensStr) {
    try {
      const tokens = JSON.parse(invitationTokensStr);
      const updatedTokens = tokens.filter((t: string) => t !== token);
      await kv.set(`workspace_${workspaceId}_invitations`, JSON.stringify(updatedTokens));
    } catch (e) {
      console.log('Error updating invitations list:', e);
    }
  }
}

async function findPendingInvitationForEmail(
  workspaceId: string,
  email: string,
  teamId?: string,
) {
  const invitationTokensStr = await kv.get(`workspace_${workspaceId}_invitations`);
  if (!invitationTokensStr) return null;
  try {
    const tokens = JSON.parse(invitationTokensStr);
    const normalizedEmail = email.toLowerCase().trim();
    for (const token of tokens) {
      const invitationData = await kv.get(`invitation_${token}`);
      if (!invitationData) continue;
      const invitation = JSON.parse(invitationData);
      const teamMatches = teamId ? invitation.teamId === teamId : !invitation.teamId;
      if (
        invitation.status === 'pending' &&
        invitation.email?.toLowerCase() === normalizedEmail &&
        teamMatches &&
        new Date(invitation.expiresAt) > new Date()
      ) {
        return { token, invitation };
      }
    }
  } catch (e) {
    console.log('findPendingInvitationForEmail error:', e);
  }
  return null;
}

async function sendWorkspaceInvitation(options: {
  workspaceId: string;
  email: string;
  name: string;
  role: string;
  invitedBy: string;
  teamId?: string;
  avatar?: string;
  emailSubjectName?: string;
}) {
  const {
    workspaceId,
    email,
    name,
    role,
    invitedBy,
    teamId,
    avatar,
    emailSubjectName,
  } = options;

  const normalizedEmail = email.toLowerCase().trim();
  const existingPending = await findPendingInvitationForEmail(workspaceId, normalizedEmail, teamId);
  if (existingPending) {
    return {
      invitation: {
        ...existingPending.invitation,
        token: existingPending.token,
      },
      inviteLink: `https://taskzm.com/invite?token=${existingPending.token}`,
      alreadyPending: true,
    };
  }

  const invitationToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  const invitation = {
    token: invitationToken,
    workspaceId,
    ...(teamId ? { teamId } : {}),
    email: normalizedEmail,
    name,
    role: role || 'member',
    ...(avatar ? { avatar } : {}),
    invitedBy,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending',
  };

  await kv.set(`invitation_${invitationToken}`, JSON.stringify(invitation));

  const existingInvitations = await kv.get(`workspace_${workspaceId}_invitations`);
  const invitations = existingInvitations ? JSON.parse(existingInvitations) : [];
  if (!invitations.includes(invitationToken)) {
    invitations.push(invitationToken);
    await kv.set(`workspace_${workspaceId}_invitations`, JSON.stringify(invitations));
  }

  const supabase = getSupabaseClient();
  let inviterName = 'Someone';
  try {
    const { data: inviterUser } = await supabase.auth.admin.getUserById(invitedBy);
    if (inviterUser?.user) {
      inviterName = inviterUser.user.user_metadata?.name || inviterUser.user.email?.split('@')[0] || 'Someone';
    }
  } catch (err) {
    console.log('Could not fetch inviter name:', err);
  }

  const workspaceName = emailSubjectName || (await kv.get(`workspace_${workspaceId}_name`));
  const inviteLink = `https://taskzm.com/invite?token=${invitationToken}`;
  const emailResult = await emailService.sendInvitationEmail({
    to: normalizedEmail,
    inviterName,
    inviteeName: name,
    workspaceName,
    role: role || 'member',
    inviteLink,
    expiresInDays: INVITATION_EXPIRY_DAYS,
  });

  if (emailResult.success) {
    console.log(`✅ Invitation email sent to ${normalizedEmail} for workspace ${workspaceId}${teamId ? ` team ${teamId}` : ''}`);
  } else {
    console.warn(`⚠️ Failed to send invitation email to ${normalizedEmail}:`, emailResult.error);
  }

  return {
    invitation: {
      ...invitation,
      token: invitationToken,
      expiresAt: invitation.expiresAt,
    },
    inviteLink,
    alreadyPending: false,
  };
}

async function addExistingUserToWorkspaceDirect(options: {
  workspaceId: string;
  existingUser: {
    id: string;
    email?: string | null;
    user_metadata?: { name?: string; avatar?: string };
  };
  name: string;
  role: string;
  avatar?: string;
  teamId?: string;
}): Promise<{ member: Record<string, unknown> } | { error: string; status: number }> {
  const { workspaceId, existingUser, name, role, avatar, teamId } = options;

  let workspaceMembers = await getWorkspaceMembers(workspaceId);
  const wasInWorkspace = workspaceMembers.includes(existingUser.id);

  if (!wasInWorkspace) {
    workspaceMembers.push(existingUser.id);
    await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(workspaceMembers));
    await kv.set(`workspace_${workspaceId}_member_${existingUser.id}_role`, role || 'member');
  }

  if (teamId) {
    const teamData = await kv.get(`team_${teamId}`);
    if (!teamData) {
      return { error: 'Team not found', status: 404 };
    }
    const team = typeof teamData === 'string' ? JSON.parse(teamData) : teamData;
    if (team.workspaceId !== workspaceId) {
      return { error: 'Team does not belong to this workspace', status: 400 };
    }

    const teamMembersData = await kv.get(`team_${teamId}_members`);
    const teamMemberIds: string[] = teamMembersData ? JSON.parse(teamMembersData) : [];

    if (teamMemberIds.includes(existingUser.id)) {
      return { error: 'User is already a team member', status: 400 };
    }
    if (teamMemberIds.length >= team.maxMembers) {
      return { error: `Maximum of ${team.maxMembers} members per team`, status: 400 };
    }

    teamMemberIds.push(existingUser.id);
    await kv.set(`team_${teamId}_members`, JSON.stringify(teamMemberIds));
    team.memberCount = teamMemberIds.length;
    await kv.set(`team_${teamId}`, JSON.stringify(team));

    await kv.set(`workspace_${workspaceId}_member_${existingUser.id}`, JSON.stringify({
      role: role || 'member',
      teamId,
    }));
  } else if (!wasInWorkspace) {
    await kv.set(`workspace_${workspaceId}_member_${existingUser.id}`, JSON.stringify({
      role: role || 'member',
    }));
  } else {
    return { error: 'User is already a member of this workspace', status: 400 };
  }

  return {
    member: {
      id: existingUser.id,
      email: existingUser.email || '',
      name: existingUser.user_metadata?.name || name,
      avatar: avatar || existingUser.user_metadata?.avatar,
      role: role || 'member',
      inviteStatus: 'accepted',
      ...(teamId ? { teamId } : {}),
    },
  };
}

async function addExistingUserToTeamDirect(options: {
  workspaceId: string;
  teamId: string;
  existingUser: {
    id: string;
    email?: string | null;
    user_metadata?: { name?: string; avatar?: string };
  };
  name: string;
  role: string;
  avatar?: string;
}): Promise<{ member: Record<string, unknown> } | { error: string; status: number }> {
  return addExistingUserToWorkspaceDirect({
    ...options,
    teamId: options.teamId,
  });
}

/**
 * Ensure user has a workspace; create one if missing (used by calendar sync and others).
 */
async function ensureUserWorkspace(userId: string): Promise<string> {
  let primaryWorkspace = await kv.get(`user_${userId}_workspace`);
  if (primaryWorkspace) return primaryWorkspace;

  console.log(`⚠️ User ${userId} has no workspace, creating one automatically`);
  const supabase = getSupabaseClient();
  let userName = 'User';
  try {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (!userError && userData?.user?.user_metadata?.name) {
      userName = userData.user.user_metadata.name;
    }
  } catch (_) {
    // use default
  }
  primaryWorkspace = `workspace_${userId}_${Date.now()}`;
  const membersArray = [userId];
  await Promise.all([
    kv.set(`user_${userId}_workspace`, primaryWorkspace),
    kv.set(`workspace_${primaryWorkspace}_owner`, userId),
    kv.set(`workspace_${primaryWorkspace}_members`, JSON.stringify(membersArray)),
    kv.set(`workspace_${primaryWorkspace}_name`, `${userName}'s Workspace`),
  ]);
  console.log(`✅ Auto-created workspace ${primaryWorkspace} for user ${userId}`);
  return primaryWorkspace;
}

// Health check endpoint
app.get("/taskzm-database-function/health", (c) => {
  return c.json({ status: "ok" });
});

// User signup endpoint
app.post("/taskzm-database-function/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, isDemo, avatar } = body;

    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400);
    }

    const supabase = getSupabaseClient();
    
    // For demo accounts, check if email already exists first
    if (isDemo) {
      try {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const emailExists = existingUsers?.users?.some(u => u.email === email);
        if (emailExists) {
          // For demo accounts, generate a new unique email if collision occurs
          const newDemoEmail = `demo_${Date.now()}_${Math.random().toString(36).substring(7)}@taskzm.app`;
          console.log(`Demo email collision detected, using new email: ${newDemoEmail}`);
          // Update email in the request
          email = newDemoEmail;
        }
      } catch (checkError) {
        console.warn('Error checking existing users for demo account:', checkError);
        // Continue with signup attempt
      }
    }
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        name,
        isDemo: isDemo || false, // Mark demo users
        avatar: avatar || undefined, // Store selected avatar
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log('Signup error:', error);
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.message?.toLowerCase().includes('already') || error.message?.toLowerCase().includes('exists')) {
        errorMessage = 'An account with this email already exists. Please try signing in instead.';
      }
      return c.json({ error: errorMessage }, 400);
    }

    // Create initial workspace for the user
    const workspaceId = `workspace_${data.user.id}_${Date.now()}`;
    const membersArray = [data.user.id];
    await kv.set(`user_${data.user.id}_workspace`, workspaceId);
    await kv.set(`workspace_${workspaceId}_owner`, data.user.id);
    await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(membersArray));
    await kv.set(`workspace_${workspaceId}_name`, `${name}'s Workspace`);
    
    console.log(`✅ Workspace created on signup: ${workspaceId} for user ${data.user.id}`);
    
    // Mark demo user in KV store for cleanup tracking and grant Pro tier access
    if (isDemo) {
      const now = Date.now();
      await kv.set(`user_${data.user.id}_is_demo`, 'true');
      await kv.set(`user_${data.user.id}_demo_login_time`, now.toString());
      await kv.set(`user_${data.user.id}_demo_last_activity`, now.toString());
      
      // Grant Pro tier access to demo accounts (yearly billing for full features)
      const demoSubscription = {
        tier: 'pro',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: null, // Demo accounts don't expire (they get cleaned up instead)
        cancelAtPeriodEnd: false,
        billingPeriod: 'yearly', // Yearly for full feature access
      };
      
      // Set subscription in both formats for compatibility
      await kv.set(`user_${data.user.id}_subscription`, demoSubscription);
      await kv.set(`user:${data.user.id}:tier`, 'pro');
      await kv.set(`user:${data.user.id}:subscription_status`, 'active');
      await kv.set(`user:${data.user.id}:subscription_store`, 'demo_account');
      await kv.set(`user:${data.user.id}:subscription_start`, demoSubscription.startDate);
      await kv.set(`user:${data.user.id}:billing_period`, 'yearly');
      
      console.log(`✅ Demo account created with Pro tier access: ${data.user.id}`);
    }

    return c.json({ user: data.user, workspaceId });
  } catch (error) {
    console.log('Error in signup:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get all tasks for a workspace (supports ifModifiedSince query for 304 Not Modified)
app.get("/taskzm-database-function/tasks/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const ifModifiedSince = c.req.query('ifModifiedSince');

    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access (owner always allowed; else must be in members list)
    const members = await getWorkspaceMembers(workspaceId);
    const membersList = Array.isArray(members) ? members : [];
    const isOwner = String(workspaceOwner) === String(userId);
    const isMember = membersList.length > 0 && membersList.includes(userId);
    if (!isOwner && !isMember) {
      return c.json({ error: 'Access denied' }, 403);
    }

    if (ifModifiedSince) {
      const lastModified = await kv.get(`workspace_${workspaceId}_tasks_modified`);
      if (lastModified && String(lastModified) === String(ifModifiedSince)) {
        return new Response(null, { status: 304, headers: { 'Last-Modified': String(lastModified) } });
      }
    }

    let tasks: unknown[] = [];
    try {
      const taskPrefix = `workspace_${workspaceId}_task_`;
      const tasksData = await kv.getByPrefix(taskPrefix);
      const tasksList = Array.isArray(tasksData) ? tasksData : [];

      // Filter to only keys that literally start with the prefix
      // (SQL LIKE treats _ as a single-char wildcard, so _tasks_modified can match _task_%)
      const taskItems = tasksList.filter((item: { key?: string }) =>
        item?.key?.startsWith(taskPrefix) && item.key.length > taskPrefix.length
      );

      tasks = taskItems
        .map((item: { key?: string; value?: unknown }) => {
          const v = item && typeof item === 'object' && 'value' in item ? item.value : null;
          return v && typeof v === 'object' && 'id' in v ? v : null;
        })
        .filter(Boolean);
    } catch (e) {
      console.log('Error in getByPrefix or mapping tasks:', e);
      tasks = [];
    }

    let lastModified = await kv.get(`workspace_${workspaceId}_tasks_modified`);
    if (!lastModified && tasks.length > 0) {
      const maxUpdated = tasks.reduce((max, t) => {
        const u = (t as { updatedAt?: string | number })?.updatedAt;
        if (!u) return max;
        const ms = typeof u === 'number' ? u : new Date(u).getTime();
        return Number.isFinite(ms) && ms > max ? ms : max;
      }, 0);
      if (maxUpdated > 0) {
        lastModified = new Date(maxUpdated).toISOString();
        await kv.set(`workspace_${workspaceId}_tasks_modified`, lastModified);
      }
    }
    const headers: Record<string, string> = {};
    if (lastModified) headers['Last-Modified'] = String(lastModified);
    return c.json({ tasks }, 200, headers);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    let errStr = errMsg;
    try {
      if (typeof error === 'object' && error !== null) errStr = JSON.stringify(error).slice(0, 200);
    } catch (_) {}
    const isIterableError = /is not iterable|not iterable|v is not iterable/i.test(errMsg) || /not iterable/i.test(errStr);
    if (isIterableError) {
      console.log('Iterable guard: returning empty tasks to avoid 500:', errMsg);
      return c.json({ tasks: [] }, 200);
    }
    console.log('Error fetching tasks:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Create or update task
app.post("/taskzm-database-function/tasks/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const body = await c.req.json();

    // The client sends the task directly (not wrapped), but handle both formats
    const task = body.task || body;

    if (!task || !task.id) {
      return c.json({ error: 'Task data with id is required' }, 400);
    }

    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace (owner always allowed; else must be in members list)
    const members = await getWorkspaceMembers(workspaceId);
    const membersList = Array.isArray(members) ? members : [];
    const isOwner = String(workspaceOwner) === String(userId);
    const isMember = membersList.length > 0 && membersList.includes(userId);
    if (!isOwner && !isMember) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Save task
    await kv.set(`workspace_${workspaceId}_task_${task.id}`, task);
    const now = new Date().toISOString();
    await kv.set(`workspace_${workspaceId}_tasks_modified`, now);

    // Update activity log
    const activity = {
      id: `activity_${Date.now()}`,
      workspaceId,
      userId,
      taskId: task.id,
      action: task.createdAt === task.updatedAt ? 'created' : 'updated',
      timestamp: Date.now(),
      taskTitle: task.title
    };
    await kv.set(`workspace_${workspaceId}_activity_${activity.id}`, activity);

    return c.json({ task });
  } catch (error) {
    console.log('Error saving task:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Delete task
app.delete("/taskzm-database-function/tasks/:workspaceId/:taskId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const taskId = c.req.param('taskId');

    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace (owner always allowed; else must be in members list)
    const members = await getWorkspaceMembers(workspaceId);
    const membersList = Array.isArray(members) ? members : [];
    const isOwner = String(workspaceOwner) === String(userId);
    const isMember = membersList.length > 0 && membersList.includes(userId);
    if (!isOwner && !isMember) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Delete task
    await kv.del(`workspace_${workspaceId}_task_${taskId}`);
    await kv.set(`workspace_${workspaceId}_tasks_modified`, new Date().toISOString());

    // Update activity log
    const activity = {
      id: `activity_${Date.now()}`,
      workspaceId,
      userId,
      taskId,
      action: 'deleted',
      timestamp: Date.now()
    };
    await kv.set(`workspace_${workspaceId}_activity_${activity.id}`, activity);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting task:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get workspace info
app.get("/taskzm-database-function/workspace/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');

    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const name = await kv.get(`workspace_${workspaceId}_name`) || 'My Workspace';
    const owner = await kv.get(`workspace_${workspaceId}_owner`);

    return c.json({ workspaceId, name, owner, members });
  } catch (error) {
    console.log('Error fetching workspace:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get user's workspaces
app.get("/taskzm-database-function/user/workspaces", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`📦 Getting workspace for user: ${userId}`);

    // Get user's primary workspace
    let primaryWorkspace = await kv.get(`user_${userId}_workspace`);
    
    // If no workspace exists, create one automatically
    if (!primaryWorkspace) {
      console.log(`⚠️ User ${userId} has no workspace, creating one automatically`);
      
      try {
        // Get user info for workspace name
        const supabase = getSupabaseClient();
        let userName = 'User';
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
          if (userError) {
            console.warn('Error fetching user data:', userError);
          } else if (userData?.user?.user_metadata?.name) {
            userName = userData.user.user_metadata.name;
          }
        } catch (userError) {
          console.warn('Error fetching user metadata, using default name:', userError);
        }
        
        // Create workspace
        primaryWorkspace = `workspace_${userId}_${Date.now()}`;
        const membersArray = [userId];
        
        // Set all workspace keys atomically
        try {
          await Promise.all([
            kv.set(`user_${userId}_workspace`, primaryWorkspace),
            kv.set(`workspace_${primaryWorkspace}_owner`, userId),
            kv.set(`workspace_${primaryWorkspace}_members`, JSON.stringify(membersArray)),
            kv.set(`workspace_${primaryWorkspace}_name`, `${userName}'s Workspace`),
          ]);
          console.log(`✅ Auto-created workspace ${primaryWorkspace} for user ${userId}`);
        } catch (setError) {
          console.error('Error setting workspace keys:', setError);
          throw new Error(`Failed to set workspace keys: ${String(setError)}`);
        }
      } catch (createError) {
        console.error('Error creating workspace:', createError);
        return c.json({ 
          error: 'Failed to create workspace',
          details: String(createError)
        }, 500);
      }
    }

    // Verify workspace exists and has required keys
    if (!primaryWorkspace) {
      console.error('Workspace creation failed - primaryWorkspace is still null');
      return c.json({ error: 'Failed to create workspace' }, 500);
    }

    // Verify workspace keys exist
    const owner = await kv.get(`workspace_${primaryWorkspace}_owner`);
    const name = await kv.get(`workspace_${primaryWorkspace}_name`) || 'My Workspace';
    
    if (!owner) {
      console.error(`Workspace ${primaryWorkspace} exists but owner key is missing`);
      return c.json({ error: 'Workspace data is incomplete' }, 500);
    }

    console.log(`✅ Returning workspace ${primaryWorkspace} for user ${userId}`);
    
    return c.json({ 
      workspaces: [{
        id: primaryWorkspace,
        name
      }]
    });
  } catch (error) {
    console.error('Error fetching user workspaces:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ 
      error: 'Internal server error',
      details: errorMessage
    }, 500);
  }
});

// Create workspace for user
app.post("/taskzm-database-function/user/workspaces", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user already has a workspace
    const existingWorkspace = await kv.get(`user_${userId}_workspace`);
    if (existingWorkspace) {
      // Return existing workspace
      const name = await kv.get(`workspace_${existingWorkspace}_name`) || 'My Workspace';
      return c.json({ 
        workspaceId: existingWorkspace,
        workspace: {
          id: existingWorkspace,
          name
        }
      });
    }

    // Create new workspace
    const body = await c.req.json();
    
    // Get user info to create workspace name
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userName = userData?.user?.user_metadata?.name || 'User';
    const finalName = body.name || `${userName}'s Workspace`;
    
    const workspaceId = `workspace_${userId}_${Date.now()}`;
    
    // Store members as JSON string to ensure consistency
    const membersArray = [userId];
    await kv.set(`user_${userId}_workspace`, workspaceId);
    await kv.set(`workspace_${workspaceId}_owner`, userId);
    await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(membersArray));
    await kv.set(`workspace_${workspaceId}_name`, finalName);
    
    console.log(`✅ Workspace created: ${workspaceId} for user ${userId}`);
    
    return c.json({ 
      workspaceId,
      workspace: {
        id: workspaceId,
        name: finalName
      }
    });
  } catch (error) {
    console.log('Error creating workspace:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get recent activities
app.get("/taskzm-database-function/activities/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');

    // Verify user has access to this workspace
    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Get activities
    const activitiesData = await kv.getByPrefix(`workspace_${workspaceId}_activity_`);
    const activities = activitiesData
      .map(item => item.value)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50); // Limit to 50 most recent

    return c.json({ activities });
  } catch (error) {
    console.log('Error fetching activities:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Save time tracking session
app.post("/taskzm-database-function/time-tracking/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const session = await c.req.json();

    // Verify user has access to this workspace
    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Save time tracking session
    await kv.set(`workspace_${workspaceId}_time_${session.id}`, session);

    return c.json({ session });
  } catch (error) {
    console.log('Error saving time tracking:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get time tracking sessions
app.get("/taskzm-database-function/time-tracking/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');

    // Verify user has access to this workspace
    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Get time tracking sessions
    const sessionsData = await kv.getByPrefix(`workspace_${workspaceId}_time_`);
    const sessions = sessionsData.map(item => item.value);

    return c.json({ sessions });
  } catch (error) {
    console.log('Error fetching time tracking:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get all projects for a workspace
app.get("/taskzm-database-function/projects/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    
    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }
    
    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Get all projects for this workspace
    const projectsData = await kv.getByPrefix(`workspace_${workspaceId}_project_`);
    const projects = projectsData.map(item => item.value);

    return c.json({ projects });
  } catch (error) {
    console.log('Error fetching projects:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Create or update project
app.post("/taskzm-database-function/projects/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const project = await c.req.json();

    // Verify user has access to this workspace
    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Save project
    await kv.set(`workspace_${workspaceId}_project_${project.id}`, project);

    return c.json({ project });
  } catch (error) {
    console.log('Error saving project:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Delete project
app.delete("/taskzm-database-function/projects/:workspaceId/:projectId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const projectId = c.req.param('projectId');

    // Verify user has access to this workspace
    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Delete project
    await kv.del(`workspace_${workspaceId}_project_${projectId}`);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error deleting project:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Helper to ensure a workspace record exists when accessing folders.
// This is primarily for backward compatibility with older workspace IDs
// that might not have had KV metadata fully initialized.
async function ensureWorkspaceForFolders(workspaceId: string, userId: string) {
  // First try to read the current owner key
  let workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);

  if (!workspaceOwner) {
    console.log(
      `⚠️ Workspace ${workspaceId} has no owner when accessing folders. ` +
      `Auto-creating workspace metadata for user ${userId}.`
    );

    // Try to get an existing name, otherwise fall back to a generic one
    let workspaceName = (await kv.get(`workspace_${workspaceId}_name`)) || "My Workspace";

    // Best‑effort attempt to get user name for nicer default
    try {
      const supabase = getSupabaseClient();
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      if (!userError && userData?.user?.user_metadata?.name) {
        workspaceName = `${userData.user.user_metadata.name}'s Workspace`;
      }
    } catch (err) {
      console.warn("Failed to fetch user metadata while auto‑creating workspace, using generic name:", err);
    }

    const membersArray = [userId];

    await Promise.all([
      // Link user to this workspace as their primary workspace
      kv.set(`user_${userId}_workspace`, workspaceId),
      // Initialize workspace metadata
      kv.set(`workspace_${workspaceId}_owner`, userId),
      kv.set(`workspace_${workspaceId}_members`, JSON.stringify(membersArray)),
      kv.set(`workspace_${workspaceId}_name`, workspaceName),
    ]);

    workspaceOwner = userId;
    console.log(`✅ Auto‑created workspace metadata for ${workspaceId} owned by ${userId}`);
  }

  return workspaceOwner;
}

// Get all folders for a workspace
app.get("/taskzm-database-function/folders/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const workspaceId = c.req.param("workspaceId");

    // Verify workspace exists (auto‑create metadata if missing for compatibility)
    const workspaceOwner = await ensureWorkspaceForFolders(workspaceId, userId);
    if (!workspaceOwner) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: "Access denied" }, 403);
    }

    const foldersData = await kv.getByPrefix(`workspace_${workspaceId}_folder_`);
    const folders = foldersData.map((item) => item.value);

    console.log(`✅ Fetched ${folders.length} folders for workspace ${workspaceId} by user ${userId}`);
    return c.json({ folders });
  } catch (error) {
    console.log("Error fetching folders:", error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Create or update folder
app.post("/taskzm-database-function/folders/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const workspaceId = c.req.param("workspaceId");
    const folder = await c.req.json();

    // Verify workspace exists (auto‑create metadata if missing for compatibility)
    const workspaceOwner = await ensureWorkspaceForFolders(workspaceId, userId);
    if (!workspaceOwner) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: "Access denied" }, 403);
    }

    if (!folder || !folder.id) {
      return c.json({ error: "Folder id is required" }, 400);
    }

    const now = new Date().toISOString();
    const folderData = {
      id: folder.id,
      name: folder.name || 'New Folder',
      description: folder.description || '',
      color: folder.color || '#3b82f6',
      createdAt: folder.createdAt || now,
      updatedAt: now,
    };

    // Store folder with workspace-scoped key
    await kv.set(`workspace_${workspaceId}_folder_${folderData.id}`, folderData);

    console.log(`✅ Created folder ${folderData.id} in workspace ${workspaceId} by user ${userId}`);
    return c.json({ folder: folderData });
  } catch (error) {
    console.log("Error saving folder:", error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Update folder
app.put("/taskzm-database-function/folders/:workspaceId/:folderId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const workspaceId = c.req.param("workspaceId");
    const folderId = c.req.param("folderId");
    const updates = await c.req.json();

    // Verify workspace exists (auto‑create metadata if missing for compatibility)
    const workspaceOwner = await ensureWorkspaceForFolders(workspaceId, userId);
    if (!workspaceOwner) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: "Access denied" }, 403);
    }

    const existingFolder = await kv.get(`workspace_${workspaceId}_folder_${folderId}`);
    if (!existingFolder) {
      return c.json({ error: "Folder not found" }, 404);
    }

    const updatedFolder = {
      ...existingFolder,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`workspace_${workspaceId}_folder_${folderId}`, updatedFolder);

    console.log(`✅ Updated folder ${folderId} in workspace ${workspaceId} by user ${userId}`);
    return c.json({ folder: updatedFolder });
  } catch (error) {
    console.log("Error updating folder:", error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Delete folder
app.delete("/taskzm-database-function/folders/:workspaceId/:folderId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const workspaceId = c.req.param("workspaceId");
    const folderId = c.req.param("folderId");

    // Verify workspace exists (auto‑create metadata if missing for compatibility)
    const workspaceOwner = await ensureWorkspaceForFolders(workspaceId, userId);
    if (!workspaceOwner) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: "Access denied" }, 403);
    }

    await kv.del(`workspace_${workspaceId}_folder_${folderId}`);

    console.log(`✅ Deleted folder ${folderId} from workspace ${workspaceId} by user ${userId}`);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting folder:", error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get workspace settings (tags, hours, rollover, view config)
app.get("/taskzm-database-function/settings/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    
    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }
    
    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Get all settings - KV store returns objects directly, no parsing needed
    const availableTags = await kv.get(`workspace_${workspaceId}_settings_tags`);
    const hoursSettings = await kv.get(`workspace_${workspaceId}_settings_hours`);
    const rolloverSettings = await kv.get(`workspace_${workspaceId}_settings_rollover`);
    const viewConfig = await kv.get(`workspace_${workspaceId}_settings_viewconfig`);

    const settings = {
      availableTags: availableTags || null,
      hoursSettings: hoursSettings || null,
      rolloverSettings: rolloverSettings || null,
      viewConfig: viewConfig || null,
    };

    return c.json({ settings });
  } catch (error) {
    console.log('Error fetching settings:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Update workspace settings
app.post("/taskzm-database-function/settings/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const { availableTags, hoursSettings, rolloverSettings, viewConfig } = await c.req.json();

    // Verify user has access to this workspace
    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Save settings - KV store handles JSONB directly, no stringify needed
    if (availableTags !== undefined) {
      await kv.set(`workspace_${workspaceId}_settings_tags`, availableTags);
    }
    if (hoursSettings !== undefined) {
      await kv.set(`workspace_${workspaceId}_settings_hours`, hoursSettings);
    }
    if (rolloverSettings !== undefined) {
      await kv.set(`workspace_${workspaceId}_settings_rollover`, rolloverSettings);
    }
    if (viewConfig !== undefined) {
      await kv.set(`workspace_${workspaceId}_settings_viewconfig`, viewConfig);
    }

    return c.json({ success: true });
  } catch (error) {
    console.log('Error saving settings:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get user subscription
app.get("/taskzm-database-function/subscription", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if this is a demo user - demo users always get Pro tier (yearly)
    const isDemoFlag = await kv.get(`user_${userId}_is_demo`);
    const isDemo = isDemoFlag === 'true';

    // Get subscription data from webhook format (primary source)
    let tier = await kv.get(`user:${userId}:tier`) || 'free';
    let status = await kv.get(`user:${userId}:subscription_status`) || 'none';
    const store = await kv.get(`user:${userId}:subscription_store`);
    let startDate = await kv.get(`user:${userId}:subscription_start`);
    const expiresAt = await kv.get(`user:${userId}:subscription_expires_at`);
    let billingPeriod = await kv.get(`user:${userId}:billing_period`);
    const cancelAtPeriodEnd = status === 'cancelled' && expiresAt && new Date(expiresAt) > new Date();

    // Also check legacy format for backwards compatibility
    const legacySubscription = await kv.get(`user_${userId}_subscription`);
    
    // If demo user, ensure they have Pro tier with yearly billing
    if (isDemo) {
      // Override subscription for demo users to ensure they always have full access
      tier = 'pro';
      status = 'active';
      billingPeriod = 'yearly';
      
      // Set start date if not already set
      if (!startDate) {
        startDate = new Date().toISOString();
        await kv.set(`user:${userId}:subscription_start`, startDate);
      }
      
      // Ensure subscription data is stored correctly for demo users
      if (tier !== 'pro' || billingPeriod !== 'yearly' || status !== 'active') {
        console.log(`🔧 Fixing subscription for demo user ${userId}: Ensuring Pro tier (yearly)`);
        
        // Update subscription in both formats
        const demoSubscription = {
          tier: 'pro',
          status: 'active',
          startDate: startDate || new Date().toISOString(),
          endDate: null, // Demo accounts don't expire
          cancelAtPeriodEnd: false,
          billingPeriod: 'yearly',
        };
        
        await kv.set(`user_${userId}_subscription`, demoSubscription);
        await kv.set(`user:${userId}:tier`, 'pro');
        await kv.set(`user:${userId}:subscription_status`, 'active');
        await kv.set(`user:${userId}:subscription_store`, 'demo_account');
        await kv.set(`user:${userId}:subscription_start`, demoSubscription.startDate);
        await kv.set(`user:${userId}:billing_period`, 'yearly');
        
        console.log(`✅ Demo user ${userId} subscription fixed: Pro tier (yearly)`);
      }
    }
    
    // Build subscription object from webhook data
    const subscription = {
      tier: tier !== 'free' ? tier : (legacySubscription?.tier || 'free'),
      status: status !== 'none' ? status : (legacySubscription?.status || 'active'),
      startDate: startDate || legacySubscription?.startDate || null,
      endDate: expiresAt || legacySubscription?.endDate || null,
      cancelAtPeriodEnd: cancelAtPeriodEnd || legacySubscription?.cancelAtPeriodEnd || false,
      billingPeriod: billingPeriod || legacySubscription?.billingPeriod || null,
    };

    return c.json({ subscription });
  } catch (error) {
    console.log('Error fetching subscription:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Update user subscription
app.post("/taskzm-database-function/subscription", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const subscription = await c.req.json();

    // SECURITY: Validate payment for Pro upgrades
    // If upgrading to Pro, verify payment was made through Stripe
    if (subscription.tier === 'pro') {
      // Check if there's a valid payment source (webhook data)
      const existingTier = await kv.get(`user:${userId}:tier`);
      const subscriptionStore = await kv.get(`user:${userId}:subscription_store`);
      const subscriptionStatus = await kv.get(`user:${userId}:subscription_status`);
      
      // Check if this is an upgrade attempt (from free to pro)
      const isUpgradeAttempt = existingTier !== 'pro';
      
      if (isUpgradeAttempt) {
        // This is an upgrade - require payment verification
        // Payment verification exists if:
        // 1. Has subscription store (stripe/app_store/play_store) indicating payment
        // 2. Has active status from webhook
        // NOTE: admin_granted is NOT a valid payment source for upgrades (use separate admin endpoint)
        const validPaymentStores = ['stripe', 'app_store', 'play_store'];
        const hasValidPayment = 
          (subscriptionStore && validPaymentStores.includes(subscriptionStore)) || // Valid payment store
          (subscriptionStatus === 'active' && subscriptionStore && validPaymentStores.includes(subscriptionStore)); // Active status with valid store
        
        // If no valid payment source, reject the upgrade
        if (!hasValidPayment) {
          console.error(`SECURITY: User ${userId} attempted to upgrade to Pro without payment verification`);
          console.error(`   Existing tier: ${existingTier}`);
          console.error(`   Subscription store: ${subscriptionStore || 'none'}`);
          console.error(`   Subscription status: ${subscriptionStatus || 'none'}`);
          return c.json({ 
            error: 'Payment verification required. Subscription upgrades must be processed through the payment system.',
            code: 'PAYMENT_VERIFICATION_REQUIRED'
          }, 403);
        }
        
        // Log the subscription upgrade for audit
        console.log(`✅ SECURITY: Subscription upgrade verified for user ${userId}: Free -> Pro (payment source: ${subscriptionStore || 'active status'})`);
      } else {
        // Already Pro - allow status updates (renewal, cancellation, etc.)
        console.log(`Subscription update for user ${userId}: Pro tier status update`);
      }
    }

    // If downgrading to free, allow it (no payment needed)
    if (subscription.tier === 'free') {
      console.log(`Subscription update for user ${userId}: Downgrading to Free tier`);
    }

    // Save subscription in both formats for compatibility
    // Legacy format (for existing code)
    await kv.set(`user_${userId}_subscription`, subscription);
    
    // Subscription data format
    // Only update if tier is being set
    if (subscription.tier) {
      // If upgrading to Pro, ensure we have payment verification
      if (subscription.tier === 'pro') {
        // Don't overwrite webhook-set data, but update if needed
        const currentStore = await kv.get(`user:${userId}:subscription_store`);
        if (!currentStore) {
          // This shouldn't happen if validation above worked, but set a flag
          await kv.set(`user:${userId}:subscription_store`, 'manual_update');
          console.warn(`Warning: Pro tier set for user ${userId} without clear payment source`);
        }
      }
      await kv.set(`user:${userId}:tier`, subscription.tier);
    }
    if (subscription.status) {
      await kv.set(`user:${userId}:subscription_status`, subscription.status);
    }
    if (subscription.startDate) {
      await kv.set(`user:${userId}:subscription_start`, subscription.startDate);
    }
    if (subscription.endDate) {
      await kv.set(`user:${userId}:subscription_expires_at`, subscription.endDate);
    }
    if (subscription.billingPeriod) {
      await kv.set(`user:${userId}:billing_period`, subscription.billingPeriod);
    }

    return c.json({ subscription });
  } catch (error) {
    console.log('Error saving subscription:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ========================================
// DELETE ACCOUNT ENDPOINT
// ========================================

// Delete user account and all associated data (for all users, not just demo)
app.delete("/taskzm-database-function/delete-account", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`🗑️ Starting account deletion for user: ${userId}`);

    const supabase = getSupabaseClient();

    // 1. Get user's workspace
    const workspaceId = await kv.get(`user_${userId}_workspace`);
    
    if (workspaceId) {
      console.log(`  📦 Deleting workspace: ${workspaceId}`);
      
      // Delete all workspace-related data
      const allKeys = await kv.getByPrefix(`workspace_${workspaceId}_`);
      console.log(`  🗑️  Found ${allKeys.length} workspace keys to delete`);
      
      let deletedWorkspaceKeys = 0;
      for (const item of allKeys) {
        try {
          await kv.del(item.key);
          deletedWorkspaceKeys++;
        } catch (e) {
          console.warn(`  ⚠️  Failed to delete workspace key ${item.key}: ${e}`);
        }
      }
      
      // Delete workspace reference
      try {
        await kv.del(`user_${userId}_workspace`);
        deletedWorkspaceKeys++;
      } catch (e) {
        console.warn(`  ⚠️  Failed to delete workspace reference: ${e}`);
      }
      
      console.log(`  ✅ Deleted ${deletedWorkspaceKeys}/${allKeys.length + 1} workspace keys`);
    }

    // 2. Delete user-specific data
    console.log(`  👤 Deleting user data for: ${userId}`);
    const userKeys = await kv.getByPrefix(`user_${userId}_`);
    console.log(`  🗑️  Found ${userKeys.length} user keys to delete`);
    
    let deletedUserKeys = 0;
    for (const item of userKeys) {
      try {
        await kv.del(item.key);
        deletedUserKeys++;
      } catch (e) {
        console.warn(`  ⚠️  Failed to delete key ${item.key}: ${e}`);
      }
    }
    
    // Also delete subscription data in the alternative format (user:userId:key)
    const subscriptionKeys = [
      `user:${userId}:tier`,
      `user:${userId}:subscription_status`,
      `user:${userId}:subscription_store`,
      `user:${userId}:subscription_start`,
      `user:${userId}:subscription_expires_at`,
      `user:${userId}:billing_period`,
    ];
    
    let deletedSubscriptionKeys = 0;
    for (const key of subscriptionKeys) {
      try {
        await kv.del(key);
        deletedSubscriptionKeys++;
      } catch (e) {
        // Subscription keys might not exist - not an error
      }
    }
    
    console.log(`  ✅ Deleted ${deletedUserKeys}/${userKeys.length} user keys and ${deletedSubscriptionKeys} subscription keys`);

    // 3. Delete calendar tokens if any
    try {
      await kv.del(`calendar_tokens_${userId}_google`);
      await kv.del(`calendar_tokens_${userId}_outlook`);
      await kv.del(`calendar_tokens_${userId}_apple`);
      console.log('  ✅ Deleted calendar tokens');
    } catch (e) {
      console.log('  ℹ️  No calendar tokens to delete');
    }

    // 4. Delete tasks from Supabase database
    try {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .single();

      if (membership?.workspace_id) {
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('workspace_id', membership.workspace_id);
        
        if (deleteError) {
          console.warn('  ⚠️  Failed to delete tasks from database:', deleteError);
        } else {
          console.log('  ✅ Deleted tasks from database');
        }

        // Delete workspace members
        const { error: membersError } = await supabase
          .from('workspace_members')
          .delete()
          .eq('workspace_id', membership.workspace_id);
        
        if (membersError) {
          console.warn('  ⚠️  Failed to delete workspace members:', membersError);
        }

        // Delete workspace if user is the only member
        const { data: remainingMembers } = await supabase
          .from('workspace_members')
          .select('id')
          .eq('workspace_id', membership.workspace_id)
          .limit(1);
        
        if (!remainingMembers || remainingMembers.length === 0) {
          const { error: workspaceError } = await supabase
            .from('workspaces')
            .delete()
            .eq('id', membership.workspace_id);
          
          if (workspaceError) {
            console.warn('  ⚠️  Failed to delete workspace:', workspaceError);
          } else {
            console.log('  ✅ Deleted workspace from database');
          }
        }
      }
    } catch (e) {
      console.warn('  ⚠️  Error deleting database records:', e);
    }

    // 5. Delete the user from Supabase Auth
    console.log(`  🔐 Deleting user from Supabase Auth: ${userId}`);
    let authDeleteSuccess = true;
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('  ⚠️  Failed to delete user from Auth:', deleteError);
      authDeleteSuccess = false;
      // Continue anyway - KV data is already cleaned
    } else {
      console.log('  ✅ Deleted user from Supabase Auth');
    }

    return c.json({
      success: true,
      message: 'Account and all associated data deleted successfully',
      deletedWorkspaceKeys: workspaceId ? deletedWorkspaceKeys : 0,
      deletedUserKeys,
      deletedSubscriptionKeys,
      authDeleted: authDeleteSuccess,
    });
  } catch (error) {
    console.error('❌ Error deleting account:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ========================================
// DEMO USER CLEANUP ENDPOINT
// ========================================

// Delete demo user and all associated data
app.delete("/taskzm-database-function/cleanup-demo-user", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if this is a demo user
    const isDemoFlag = await kv.get(`user_${userId}_is_demo`);
    if (!isDemoFlag || isDemoFlag !== 'true') {
      return c.json({ error: 'Not a demo user - cleanup not allowed' }, 403);
    }

    console.log(`🧹 Starting cleanup for demo user: ${userId}`);

    const supabase = getSupabaseClient();

    // 1. Get user's workspace
    const workspaceId = await kv.get(`user_${userId}_workspace`);
    
    if (workspaceId) {
      console.log(`  📦 Deleting workspace: ${workspaceId}`);
      
      // Delete all workspace-related data
      const allKeys = await kv.getByPrefix(`workspace_${workspaceId}_`);
      console.log(`  🗑️  Found ${allKeys.length} workspace keys to delete`);
      
      let deletedWorkspaceKeys = 0;
      for (const item of allKeys) {
        try {
          await kv.del(item.key);
          deletedWorkspaceKeys++;
        } catch (e) {
          console.warn(`  ⚠️  Failed to delete workspace key ${item.key}: ${e}`);
        }
      }
      
      // Delete workspace reference
      try {
        await kv.del(`user_${userId}_workspace`);
        deletedWorkspaceKeys++;
      } catch (e) {
        console.warn(`  ⚠️  Failed to delete workspace reference: ${e}`);
      }
      
      console.log(`  ✅ Deleted ${deletedWorkspaceKeys}/${allKeys.length + 1} workspace keys`);
    }

    // 2. Delete user-specific data (including login timestamp, activity tracking, and subscription data)
    console.log(`  👤 Deleting user data for: ${userId}`);
    const userKeys = await kv.getByPrefix(`user_${userId}_`);
    console.log(`  🗑️  Found ${userKeys.length} user keys to delete`);
    
    let deletedUserKeys = 0;
    for (const item of userKeys) {
      try {
        await kv.del(item.key);
        deletedUserKeys++;
      } catch (e) {
        console.warn(`  ⚠️  Failed to delete key ${item.key}: ${e}`);
      }
    }
    
    // Also delete subscription data in the alternative format (user:userId:key)
    const subscriptionKeys = [
      `user:${userId}:tier`,
      `user:${userId}:subscription_status`,
      `user:${userId}:subscription_store`,
      `user:${userId}:subscription_start`,
      `user:${userId}:subscription_expires_at`,
      `user:${userId}:billing_period`,
    ];
    
    let deletedSubscriptionKeys = 0;
    for (const key of subscriptionKeys) {
      try {
        await kv.del(key);
        deletedSubscriptionKeys++;
      } catch (e) {
        // Subscription keys might not exist - not an error
      }
    }
    
    console.log(`  ✅ Deleted ${deletedUserKeys}/${userKeys.length} user keys and ${deletedSubscriptionKeys} subscription keys`);

    // 3. Delete calendar tokens if any
    try {
      await kv.del(`calendar_tokens_${userId}_google`);
      await kv.del(`calendar_tokens_${userId}_outlook`);
      await kv.del(`calendar_tokens_${userId}_apple`);
    } catch (e) {
      console.log('  ℹ️  No calendar tokens to delete');
    }

    // 4. Delete the user from Supabase Auth
    console.log(`  🔐 Deleting user from Supabase Auth: ${userId}`);
    let authDeleteSuccess = true;
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('  ⚠️  Failed to delete user from Auth:', deleteError);
      authDeleteSuccess = false;
      // Continue anyway - KV data is already cleaned
    }

    // 5. Verify cleanup completion
    console.log(`  🔍 Verifying cleanup completion...`);
    const verification = await cleanupUtils.verifyUserCleanup(userId);
    
    if (verification.remainingKeys.length > 0) {
      console.warn(`  ⚠️  Warning: ${verification.remainingKeys.length} keys still remain after cleanup`);
      console.warn(`  Remaining keys: ${verification.remainingKeys.slice(0, 5).join(', ')}${verification.remainingKeys.length > 5 ? '...' : ''}`);
    } else {
      console.log(`  ✅ Verification passed: All user data cleaned`);
    }

    const cleanupStatus = {
      kvDataCleaned: verification.isClean,
      authUserDeleted: authDeleteSuccess,
      remainingKeys: verification.remainingKeys,
    };

    if (cleanupStatus.kvDataCleaned && cleanupStatus.authUserDeleted) {
      console.log(`✅ Demo user cleanup completed successfully: ${userId}`);
    } else {
      console.warn(`⚠️  Demo user cleanup completed with warnings: ${userId}`, cleanupStatus);
    }

    return c.json({ 
      success: cleanupStatus.kvDataCleaned && cleanupStatus.authUserDeleted,
      message: cleanupStatus.kvDataCleaned && cleanupStatus.authUserDeleted
        ? 'Demo user and all associated data deleted successfully'
        : 'Demo user cleanup completed with some warnings',
      deletedWorkspace: workspaceId,
      verification: cleanupStatus,
    });
  } catch (error) {
    console.error('Error cleaning up demo user:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get demo user statistics (admin endpoint)
app.get("/taskzm-database-function/admin/demo-stats", async (c) => {
  try {
    const { userId, error: authError } = await verifyAdmin(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: authError || 'Unauthorized' }, 401);
    }

    const stats = await cleanupUtils.getDemoUserStats();
    
    return c.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting demo stats:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Manual cleanup of all demo users (admin endpoint - use with caution!)
app.post("/taskzm-database-function/admin/cleanup-all-demos", async (c) => {
  try {
    const { userId, error: authError } = await verifyAdmin(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: authError || 'Unauthorized' }, 401);
    }

    console.log(`⚠️  Manual cleanup of all demo users initiated by admin ${userId}`);
    
    const result = await cleanupUtils.cleanupAllDemoUsers();
    const report = cleanupUtils.generateCleanupReport(result);
    
    console.log(report);
    
    return c.json({
      ...result,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in manual cleanup:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ========================================
// DEMO USER SESSION MANAGEMENT
// ========================================

// Update demo user login timestamp
app.post("/taskzm-database-function/demo/update-login-time", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Verify this is a demo user
    const isDemoFlag = await kv.get(`user_${userId}_is_demo`);
    if (!isDemoFlag || isDemoFlag !== 'true') {
      return c.json({ error: 'Not a demo user' }, 403);
    }

    // Update login timestamp and activity timestamp
    const now = Date.now();
    await kv.set(`user_${userId}_demo_login_time`, now.toString());
    await kv.set(`user_${userId}_demo_last_activity`, now.toString());
    
    return c.json({ success: true, loginTime: now, lastActivity: now });
  } catch (error) {
    console.log('Error updating demo login time:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Update demo user activity timestamp
app.post("/taskzm-database-function/demo/update-activity", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Verify this is a demo user
    const isDemoFlag = await kv.get(`user_${userId}_is_demo`);
    if (!isDemoFlag || isDemoFlag !== 'true') {
      return c.json({ error: 'Not a demo user' }, 403);
    }

    // Update activity timestamp
    const now = Date.now();
    await kv.set(`user_${userId}_demo_last_activity`, now.toString());
    
    return c.json({ success: true, lastActivity: now });
  } catch (error) {
    console.log('Error updating demo activity:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Cleanup inactive demo users (called by background job or admin)
// This endpoint checks for demo users with no activity > DEMO_CLEANUP_TIMEOUT_MINUTES and cleans them up
app.post("/taskzm-database-function/demo/cleanup-inactive", async (c) => {
  try {
    // Verify admin access or scheduled job token
    // For scheduled jobs, you can pass a secret token in the request body
    const body = await c.req.json().catch(() => ({}));
    const scheduledJobToken = body.scheduledJobToken;
    const scheduledJobSecret = Deno.env.get('SCHEDULED_JOB_SECRET');
    
    // Allow if it's a valid scheduled job token OR if user is admin
    if (!scheduledJobToken || scheduledJobToken !== scheduledJobSecret) {
      const { userId, error: authError } = await verifyAdmin(c.req.raw);
      if (authError || !userId) {
        return c.json({ error: authError || 'Unauthorized - Admin access or valid scheduled job token required' }, 401);
      }
    }
    
    // Use constant for default timeout, but allow override via request body
    const { maxInactiveMinutes = DEMO_CLEANUP_TIMEOUT_MINUTES } = body;
    
    console.log(`🧹 Starting cleanup of inactive demo users (inactive > ${maxInactiveMinutes} minutes)`);
    
    // Get all demo user IDs
    const demoUserIds = await cleanupUtils.getAllDemoUserIds();
    const now = Date.now();
    const maxInactiveMs = maxInactiveMinutes * 60 * 1000;
    let cleanedCount = 0;
    const errors: string[] = [];

    for (const userId of demoUserIds) {
      try {
        // Get last activity time
        const lastActivityStr = await kv.get(`user_${userId}_demo_last_activity`);
        
        if (!lastActivityStr) {
          // No activity recorded, check login time as fallback
          const loginTimeStr = await kv.get(`user_${userId}_demo_login_time`);
          if (!loginTimeStr) {
            // No activity or login time - clean up
            console.log(`  🗑️  Cleaning up demo user ${userId} (no activity recorded)`);
            const result = await cleanupDemoUser(userId);
            if (result.success) {
              cleanedCount++;
            } else {
              errors.push(`User ${userId}: ${result.errors.join('; ')}`);
              if (result.verification && !result.verification.isClean) {
                console.warn(`  ⚠️  User ${userId} cleanup incomplete: ${result.verification.remainingKeys.length} keys remaining`);
              }
            }
            continue;
          }
          
          // Use login time if no activity recorded
          const lastActivity = parseInt(loginTimeStr);
          const inactiveMs = now - lastActivity;
          
          if (inactiveMs > maxInactiveMs) {
            console.log(`  🗑️  Cleaning up inactive demo user ${userId} (${Math.round(inactiveMs / 60000)} minutes inactive)`);
            const result = await cleanupDemoUser(userId);
            if (result.success) {
              cleanedCount++;
            } else {
              errors.push(`User ${userId}: ${result.errors.join('; ')}`);
              if (result.verification && !result.verification.isClean) {
                console.warn(`  ⚠️  User ${userId} cleanup incomplete: ${result.verification.remainingKeys.length} keys remaining`);
              }
            }
          }
        } else {
          const lastActivity = parseInt(lastActivityStr);
          const inactiveMs = now - lastActivity;
          
          if (inactiveMs > maxInactiveMs) {
            console.log(`  🗑️  Cleaning up inactive demo user ${userId} (${Math.round(inactiveMs / 60000)} minutes inactive)`);
            const result = await cleanupDemoUser(userId);
            if (result.success) {
              cleanedCount++;
            } else {
              errors.push(`User ${userId}: ${result.errors.join('; ')}`);
              if (result.verification && !result.verification.isClean) {
                console.warn(`  ⚠️  User ${userId} cleanup incomplete: ${result.verification.remainingKeys.length} keys remaining`);
              }
            }
          }
        }
      } catch (error) {
        const errorMsg = `Failed to cleanup demo user ${userId}: ${error}`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
        // Log full error details for debugging
        if (error instanceof Error) {
          console.error(`  Error details: ${error.message}`, error.stack);
        }
      }
    }

    const successRate = demoUserIds.length > 0 
      ? ((cleanedCount / demoUserIds.length) * 100).toFixed(1)
      : '100';
    
    console.log(`✅ Cleanup completed: ${cleanedCount}/${demoUserIds.length} demo users cleaned up (${successRate}% success rate)`);
    
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} error(s) encountered during cleanup`);
    }

    return c.json({
      success: errors.length === 0,
      cleanedCount,
      totalChecked: demoUserIds.length,
      successRate: `${successRate}%`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in inactive demo cleanup:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Helper function to cleanup a single demo user
async function cleanupDemoUser(userId: string): Promise<{
  success: boolean;
  errors: string[];
  verification?: { isClean: boolean; remainingKeys: string[] };
}> {
  const supabase = getSupabaseClient();
  const errors: string[] = [];
  
  try {
    // Get user's workspace
    const workspaceId = await kv.get(`user_${userId}_workspace`);
    
    if (workspaceId) {
      try {
        // Delete all workspace-related data
        const allKeys = await kv.getByPrefix(`workspace_${workspaceId}_`);
        for (const item of allKeys) {
          try {
            await kv.del(item.key);
          } catch (e) {
            errors.push(`Failed to delete workspace key ${item.key}: ${e}`);
          }
        }
        await kv.del(`user_${userId}_workspace`);
      } catch (e) {
        errors.push(`Failed to delete workspace ${workspaceId}: ${e}`);
      }
    }

    // Delete user-specific data (including subscription data)
    try {
      const userKeys = await kv.getByPrefix(`user_${userId}_`);
      for (const item of userKeys) {
        try {
          await kv.del(item.key);
        } catch (e) {
          errors.push(`Failed to delete user key ${item.key}: ${e}`);
        }
      }
      
      // Also delete subscription data in the alternative format (user:userId:key)
      const subscriptionKeys = [
        `user:${userId}:tier`,
        `user:${userId}:subscription_status`,
        `user:${userId}:subscription_store`,
        `user:${userId}:subscription_start`,
        `user:${userId}:subscription_expires_at`,
        `user:${userId}:billing_period`,
      ];
      
      for (const key of subscriptionKeys) {
        try {
          await kv.del(key);
        } catch (e) {
          // Subscription keys might not exist - not an error
        }
      }
    } catch (e) {
      errors.push(`Failed to delete user data: ${e}`);
    }

    // Delete calendar tokens
    try {
      await kv.del(`calendar_tokens_${userId}_google`);
      await kv.del(`calendar_tokens_${userId}_outlook`);
      await kv.del(`calendar_tokens_${userId}_apple`);
    } catch (e) {
      // Calendar tokens might not exist - not an error
    }

    // Delete the user from Supabase Auth
    try {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteError) {
        errors.push(`Failed to delete user from Auth: ${deleteError.message}`);
      }
    } catch (e) {
      errors.push(`Failed to delete user from Auth: ${e}`);
    }

    // Verify cleanup
    const verification = await cleanupUtils.verifyUserCleanup(userId);
    
    return {
      success: errors.length === 0 && verification.isClean,
      errors,
      verification,
    };
  } catch (e) {
    errors.push(`General cleanup error: ${e}`);
    return {
      success: false,
      errors,
    };
  }
}

// ========================================
// CALENDAR INTEGRATION ENDPOINTS
// ========================================

// Initiate Google Calendar OAuth flow
app.get("/taskzm-database-function/calendar/google/config", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const diagnostics = getGoogleOAuthConfigDiagnostics();
    return c.json({
      configured: diagnostics.hasClientId && diagnostics.hasClientSecret && diagnostics.hasRedirectUri,
      ...diagnostics,
    });
  } catch (error) {
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Initiate Google Calendar OAuth flow
app.get("/taskzm-database-function/calendar/google/auth", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const oauthConfig = getGoogleOAuthConfig();

    console.log('Google OAuth config check:', {
      ...getGoogleOAuthConfigDiagnostics(),
      clientIdPrefix: oauthConfig?.clientId ? `${oauthConfig.clientId.substring(0, 20)}...` : 'missing',
    });

    if (!oauthConfig) {
      console.log('Google OAuth not configured - missing env vars');
      return c.json({ 
        error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in Supabase Edge Function secrets.',
        details: getGoogleOAuthConfigDiagnostics(),
      }, 500);
    }

    // Single scope: calendar.readonly (calendar list + events). Google classifies ALL Calendar read scopes as "sensitive," so the "sensitive info" warning appears until the app is verified. We do not request any other scopes. See docs/GOOGLE_CALENDAR_CALLBACK_FIX.md.
    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', oauthConfig.clientId);
    authUrl.searchParams.set('redirect_uri', oauthConfig.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', encodeURIComponent(userId)); // Pass userId in state (encoded for reserved chars)

    console.log('Google OAuth URL generated successfully for user:', userId, 'redirect_uri:', oauthConfig.redirectUri);
    return c.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.log('Error initiating Google OAuth:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Use Google OAuth tokens from Supabase session
app.post("/taskzm-database-function/calendar/google/use-supabase-tokens", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { providerToken, providerRefreshToken } = await c.req.json();

    if (!providerToken) {
      return c.json({ error: 'No provider token provided' }, 400);
    }

    // Verify the token works with Google Calendar API
    const testResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        'Authorization': `Bearer ${providerToken}`,
      },
    });

    if (!testResponse.ok) {
      // Token might not have calendar scopes - need to request them
      if (testResponse.status === 403) {
        return c.json({ 
          success: false,
          error: 'Token does not have calendar permissions. Please use OAuth flow to grant calendar access.',
        }, 403);
      }
      throw new Error(`Token validation failed: ${testResponse.status}`);
    }

    // Token is valid - store it for calendar use
    const tokens: calendarSync.CalendarTokens = {
      accessToken: providerToken,
      refreshToken: providerRefreshToken,
      expiresAt: Date.now() + (3600 * 1000), // Assume 1 hour expiry (will refresh if needed) - using calculation for clarity
      provider: 'google',
    };

    await calendarSync.storeCalendarTokens(userId, 'google', tokens);
    console.log('Google Calendar tokens stored from Supabase session for user:', userId);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error using Supabase Google tokens:', error);
    return c.json({ 
      success: false,
      error: getErrorMessage(error) 
    }, 500);
  }
});

// Google Calendar OAuth callback
app.get("/taskzm-database-function/calendar/google/callback", async (c) => {
  try {
    const code = c.req.query('code');
    const stateParam = c.req.query('state');
    const userId = stateParam ? decodeURIComponent(stateParam) : '';
    const error = c.req.query('error');

    console.log('Google OAuth callback received:', { 
      hasCode: !!code, 
      hasUserId: !!userId, 
      error,
      queryParams: Object.fromEntries(c.req.url.split('?')[1]?.split('&').map(p => p.split('=')) || [])
    });

    if (error) {
      // Return HTML page that closes popup and notifies parent of error
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connection Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-error', 
        provider: 'google',
        error: '${error.replace(/'/g, "\\'")}'
      }, '*');
      window.close();
    } else {
      window.location.href = '${Deno.env.get('APP_URL') || 'https://taskzm.app'}';
    }
  </script>
  <p>Connection failed: ${error}. This window will close automatically.</p>
</body>
</html>`;
      return c.html(html);
    }

    if (!code || !userId) {
      // Return HTML page that closes popup and notifies parent of error
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connection Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-error', 
        provider: 'google',
        error: 'Missing authorization code or user ID'
      }, '*');
      window.close();
    } else {
      window.location.href = '${Deno.env.get('APP_URL') || 'https://taskzm.app'}';
    }
  </script>
  <p>Connection failed: Missing authorization code or user ID. This window will close automatically.</p>
</body>
</html>`;
      return c.html(html);
    }

    const oauthConfig = getGoogleOAuthConfig();
    console.log('Google OAuth callback token exchange redirect_uri:', oauthConfig?.redirectUri ?? 'null');

    if (!oauthConfig) {
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connection Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-error', 
        provider: 'google',
        error: 'Google OAuth not configured'
      }, '*');
      window.close();
    } else {
      window.location.href = '${Deno.env.get('APP_URL') || 'https://taskzm.app'}';
    }
  </script>
  <p>Connection failed: Google OAuth not configured. This window will close automatically.</p>
</body>
</html>`;
      return c.html(html);
    }

    // Exchange code for tokens
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret,
        redirect_uri: oauthConfig.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const userMessage = mapGoogleTokenExchangeError(errorText);
      console.log('Google token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        diagnostics: getGoogleOAuthConfigDiagnostics(),
      });
      const escapedMessage = userMessage.replace(/'/g, "\\'").replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const bodyEscaped = userMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      // Return HTML page that closes popup and notifies parent of error
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connection Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-error', 
        provider: 'google',
        error: '${escapedMessage}'
      }, '*');
      window.close();
    } else {
      window.location.href = '${Deno.env.get('APP_URL') || 'https://taskzm.app'}';
    }
  </script>
  <p>Connection failed: ${bodyEscaped} This window will close automatically.</p>
</body>
</html>`;
      return c.html(html);
    }

    const data = await response.json();

    console.log('Google token exchange successful for user:', userId);

    // Store tokens with error handling
    const tokens: calendarSync.CalendarTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      provider: 'google',
    };

    const appUrl = Deno.env.get('APP_URL') || 'https://taskzm.app';
    
    // CRITICAL FIX: Wrap token storage in try-catch to ensure we always return HTML with postMessage
    try {
      await calendarSync.storeCalendarTokens(userId, 'google', tokens);
      console.log('Google Calendar tokens stored successfully for user:', userId);

      // Return HTML page that closes popup and notifies parent
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connected</title>
</head>
<body>
  <script>
    // ENHANCED: Ensure message is sent before closing popup
    // Add small delay to ensure postMessage is processed by parent window
    if (window.opener) {
      try {
        // Send success message to parent window
        window.opener.postMessage({ 
          type: 'calendar-oauth-success', 
          provider: 'google' 
        }, '*');
        
        // Log for debugging
        console.log('[Google Calendar OAuth] Success message sent to parent window');
        
        // Wait a bit before closing to ensure message is received
        setTimeout(() => {
          window.close();
        }, 200);
      } catch (error) {
        console.error('[Google Calendar OAuth] Error sending message:', error);
        // Fallback: redirect to app
        setTimeout(() => {
          window.location.href = '${appUrl}';
        }, 500);
      }
    } else {
      // No opener (popup was blocked or closed) - redirect to app
      window.location.href = '${appUrl}';
    }
  </script>
  <p>Calendar connected successfully! This window will close automatically.</p>
</body>
</html>`;
      
      return c.html(html);
    } catch (storageError) {
      // CRITICAL FIX: If token storage fails, still return HTML with error message
      // This ensures the parent window receives notification instead of showing JSON error
      console.error('Error storing Google Calendar tokens:', storageError);
      const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connection Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-error', 
        provider: 'google',
        error: 'Failed to store calendar tokens. Please try again.'
      }, '*');
      setTimeout(() => {
        window.close();
      }, 200);
    } else {
      window.location.href = '${appUrl}';
    }
  </script>
  <p>Connection failed: Failed to store calendar tokens. This window will close automatically.</p>
</body>
</html>`;
      return c.html(errorHtml);
    }
  } catch (error) {
    // CRITICAL FIX: Catch all errors and return HTML with postMessage instead of JSON
    // This ensures the parent window always receives notification
    console.error('Error in Google OAuth callback:', error);
    const appUrl = Deno.env.get('APP_URL') || 'https://taskzm.app';
    const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connection Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-error', 
        provider: 'google',
        error: '${String(getErrorMessage(error)).replace(/'/g, "\\'").replace(/"/g, '&quot;')}'
      }, '*');
      setTimeout(() => {
        window.close();
      }, 200);
    } else {
      window.location.href = '${appUrl}';
    }
  </script>
  <p>Connection failed: ${String(getErrorMessage(error)).replace(/</g, '&lt;').replace(/>/g, '&gt;')}. This window will close automatically.</p>
</body>
</html>`;
    return c.html(errorHtml);
  }
});

// Sync Google Calendar events from Google to database (import calendar events)
app.post("/taskzm-database-function/calendar/google/sync", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    let userTimezone = 'America/New_York';
    try {
      const body = await c.req.json().catch(() => ({}));
      if (body?.userTimezone) userTimezone = body.userTimezone;
    } catch {
      // optional body
    }

    const tokens = await calendarSync.getCalendarTokens(userId, 'google');
    if (!tokens) {
      return c.json({ success: false, error: 'Google Calendar not connected. Please connect your Google Calendar first.' }, 400);
    }

    const workspaceId = await kv.get(`user_${userId}_workspace`);
    if (!workspaceId) {
      return c.json({ success: false, error: 'No workspace found. Please try logging out and back in.' }, 400);
    }

    const supabase = getSupabaseClient();
    const result = await googleCalendarSync.syncGoogleCalendarsToDatabase(
      supabase,
      userId,
      workspaceId,
      userTimezone
    );

    const errorMessage = result.errors?.length ? result.errors.join(' ') : undefined;
    return c.json({
      success: result.success,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      ...(errorMessage && { error: errorMessage }),
    });
  } catch (error) {
    console.error('Google Calendar sync error:', error);
    return c.json({
      success: false,
      error: getErrorMessage(error),
    }, 500);
  }
});

// Initiate Outlook Calendar OAuth flow
app.get("/taskzm-database-function/calendar/outlook/auth", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const clientId = Deno.env.get('OUTLOOK_CLIENT_ID');
    const redirectUri = Deno.env.get('OUTLOOK_REDIRECT_URI');

    if (!clientId || !redirectUri) {
      return c.json({ error: 'Outlook OAuth not configured' }, 500);
    }

    const scopes = [
      'https://graph.microsoft.com/Calendars.Read',
      'offline_access',
    ];

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('state', userId);

    return c.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.log('Error initiating Outlook OAuth:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Outlook Calendar OAuth callback
app.get("/taskzm-database-function/calendar/outlook/callback", async (c) => {
  try {
    const code = c.req.query('code');
    const userId = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      // Return HTML page that closes popup and notifies parent of error
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connection Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-error', 
        provider: 'outlook',
        error: '${error}'
      }, '*');
      window.close();
    } else {
      window.location.href = '${Deno.env.get('APP_URL') || 'https://taskzm.app'}';
    }
  </script>
  <p>Connection failed: ${error}. This window will close automatically.</p>
</body>
</html>`;
      return c.html(html);
    }

    if (!code || !userId) {
      // Return HTML page that closes popup and notifies parent of error
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connection Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-error', 
        provider: 'outlook',
        error: 'Missing authorization code or user ID'
      }, '*');
      window.close();
    } else {
      window.location.href = '${Deno.env.get('APP_URL') || 'https://taskzm.app'}';
    }
  </script>
  <p>Connection failed: Missing authorization code or user ID. This window will close automatically.</p>
</body>
</html>`;
      return c.html(html);
    }

    const clientId = Deno.env.get('OUTLOOK_CLIENT_ID');
    const clientSecret = Deno.env.get('OUTLOOK_CLIENT_SECRET');
    const redirectUri = Deno.env.get('OUTLOOK_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connection Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-error', 
        provider: 'outlook',
        error: 'Outlook OAuth not configured'
      }, '*');
      window.close();
    } else {
      window.location.href = '${Deno.env.get('APP_URL') || 'https://taskzm.app'}';
    }
  </script>
  <p>Connection failed: Outlook OAuth not configured. This window will close automatically.</p>
</body>
</html>`;
      return c.html(html);
    }

    // Exchange code for tokens
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'https://graph.microsoft.com/Calendars.Read offline_access',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Return HTML page that closes popup and notifies parent of error
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connection Failed</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-error', 
        provider: 'outlook',
        error: 'Failed to exchange authorization code'
      }, '*');
      window.close();
    } else {
      window.location.href = '${Deno.env.get('APP_URL') || 'https://taskzm.app'}';
    }
  </script>
  <p>Connection failed: Failed to exchange authorization code. This window will close automatically.</p>
</body>
</html>`;
      return c.html(html);
    }

    const data = await response.json();

    // Store tokens
    const tokens: calendarSync.CalendarTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      provider: 'outlook',
    };

    await calendarSync.storeCalendarTokens(userId, 'outlook', tokens);

    // Return HTML page that closes popup and notifies parent
    const appUrl = Deno.env.get('APP_URL') || 'https://taskzm.app';
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Calendar Connected</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'calendar-oauth-success', 
        provider: 'outlook' 
      }, '*');
      window.close();
    } else {
      window.location.href = '${appUrl}';
    }
  </script>
  <p>Calendar connected successfully! This window will close automatically.</p>
</body>
</html>`;
    
    return c.html(html);
  } catch (error) {
    console.log('Error in Outlook OAuth callback:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Check calendar connection status
app.get("/taskzm-database-function/calendar/status", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      console.log('Calendar status check - unauthorized:', { authError, userId });
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const googleTokens = await calendarSync.getCalendarTokens(userId, 'google');
    const outlookTokens = await calendarSync.getCalendarTokens(userId, 'outlook');
    
    // Check for Apple CalDAV credentials (new flow)
    const appleCalDAVCredentials = await kv.get(`caldav_credentials_${userId}`);
    // Also check old Apple tokens for backwards compatibility
    const appleTokens = await calendarSync.getCalendarTokens(userId, 'apple');

    const status = {
      google: !!googleTokens,
      outlook: !!outlookTokens,
      apple: !!appleCalDAVCredentials || !!appleTokens,
    };

    console.log('Calendar status for user:', userId, status);
    return c.json(status);
  } catch (error) {
    console.log('Error checking calendar status:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Apple Calendar CalDAV connection setup - Shortcut Method
// Register both with and without prefix for compatibility
const appleCalendarSetupHandler = async (c: any) => {
  console.log('Apple Calendar setup endpoint called (shortcut method)', {
    method: c.req.method,
    path: new URL(c.req.url).pathname,
  });
  
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get credentials from request
    let username: string;
    let appPassword: string;

    try {
      const body = await c.req.json();
      username = body.username || body.email;
      appPassword = body.appPassword;
    } catch (parseError) {
      return c.json({ error: 'Invalid request body. Please provide username (email) and appPassword.' }, 400);
    }

    if (!username || !appPassword) {
      return c.json({ error: 'Missing credentials. Please provide your iCloud email and app-specific password.' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username)) {
      return c.json({ error: 'Invalid email format. Please enter a valid iCloud email address.' }, 400);
    }

    // Validate app-specific password format
    // Apple app-specific passwords are 16 characters (xxxx-xxxx-xxxx-xxxx) or 19 with hyphens
    const cleanedPassword = appPassword.replace(/[\s-]/g, ''); // Remove spaces and hyphens
    if (cleanedPassword.length !== 16) {
      return c.json({ 
        error: 'Invalid app-specific password format. Apple app-specific passwords are 16 characters (format: xxxx-xxxx-xxxx-xxxx). Please generate a new one at appleid.apple.com' 
      }, 400);
    }
    
    // Check if password contains only alphanumeric characters (Apple passwords are lowercase letters only)
    if (!/^[a-z]+$/i.test(cleanedPassword)) {
      return c.json({ 
        error: 'Invalid app-specific password. Apple app-specific passwords contain only letters. Please check that you copied the correct password.' 
      }, 400);
    }

    // Use base iCloud CalDAV URL; discovery will resolve the real calendar URL
    const caldavUrl = `https://caldav.icloud.com/`;
    
    console.log('Using base CalDAV URL:', caldavUrl);

    // Simple connection test - just verify credentials work
    try {
      const cleanPassword = appPassword.replace(/\s+/g, ''); // Remove any spaces
      const response = await fetch(caldavUrl, {
        method: 'PROPFIND',
        headers: {
          'Authorization': `Basic ${btoa(`${username}:${cleanPassword}`)}`,
          'Depth': '0',
          'Content-Type': 'application/xml; charset=utf-8',
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <current-user-principal/>
  </prop>
</propfind>`,
      });

      // Accept 207 (Multi-Status) or 200/201 as success
      if (!response.ok && response.status !== 207) {
        // If this URL doesn't work, try the base URL
        const baseResponse = await fetch('https://caldav.icloud.com/', {
          method: 'PROPFIND',
          headers: {
            'Authorization': `Basic ${btoa(`${username}:${cleanPassword}`)}`,
            'Depth': '0',
            'Content-Type': 'application/xml; charset=utf-8',
          },
          body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <current-user-principal/>
  </prop>
</propfind>`,
        });

        if (!baseResponse.ok && baseResponse.status !== 207) {
          if (baseResponse.status === 401 || baseResponse.status === 403) {
            return c.json({ 
              error: 'Authentication failed. Please check your iCloud email and app-specific password. Make sure you copied the entire password without spaces.' 
            }, 400);
          }
          // Non-auth errors - still store credentials, let actual operations handle discovery
          console.log('CalDAV test returned non-200 status, but storing credentials anyway:', baseResponse.status);
        }
      }
    } catch (testError) {
      // Connection test failed, but we'll still store credentials
      // The actual calendar operations will handle URL discovery
      console.log('CalDAV connection test failed (non-blocking):', testError);
    }

    // Store credentials - use the shortcut URL format
    try {
      const tokens: calendarSync.CalendarTokens = {
        accessToken: appPassword,
        provider: 'apple',
        email: username,
        caldavUrl: caldavUrl, // Use shortcut URL format
        caldavUsername: username,
        caldavPassword: appPassword,
      };

      await calendarSync.storeCalendarTokens(userId, 'apple', tokens);
      console.log('Apple Calendar credentials stored successfully (shortcut method)');
      
      return c.json({ success: true });
    } catch (storeError) {
      console.log('Error storing Apple Calendar tokens:', storeError);
      return c.json({ 
        error: 'Failed to store calendar credentials. Please try again.' 
      }, 500);
    }
  } catch (error) {
    console.log('Error setting up Apple Calendar:', error);
    return c.json({ 
      error: 'An unexpected error occurred. Please try again.' 
    }, 500);
  }
};

// Register the route both with and without the prefix for compatibility
// IMPORTANT: Register routes BEFORE the catch-all route
app.post("/taskzm-database-function/calendar/apple/setup", appleCalendarSetupHandler);
app.post("/calendar/apple/setup", appleCalendarSetupHandler);

// Test/Verify Apple Calendar connection - SHORTCUT METHOD
// Validates credentials by testing authentication only (no complex discovery)
app.get("/taskzm-database-function/calendar/apple/test", async (c) => {
  console.log('Apple Calendar test endpoint called (shortcut method)');
  
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get stored tokens
    const tokens = await calendarSync.getCalendarTokens(userId, 'apple');
    if (!tokens) {
      return c.json({ 
        success: false, 
        error: 'No Apple Calendar credentials found. Please connect Apple Calendar first.',
        hasTokens: false,
      }, 400);
    }

    // Validate tokens have required fields
    if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
      return c.json({ 
        success: false, 
        error: 'Apple Calendar credentials incomplete. Please reconnect Apple Calendar.',
        hasTokens: true,
        hasCredentials: false,
      }, 400);
    }

    console.log('Testing Apple Calendar connection for user:', userId, {
      username: tokens.caldavUsername,
    });

    // SHORTCUT METHOD: Just test authentication with a simple PROPFIND
    const cleanPassword = tokens.caldavPassword.replace(/\s+/g, '');
    const authTestResponse = await fetch('https://caldav.icloud.com/', {
      method: 'PROPFIND',
      headers: {
        'Authorization': `Basic ${btoa(`${tokens.caldavUsername}:${cleanPassword}`)}`,
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8',
        'User-Agent': 'TaskZM-CalDAV-Client/1.0',
      },
      body: `<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><current-user-principal/></prop></propfind>`,
    });

    console.log('Auth test response:', authTestResponse.status, authTestResponse.statusText);

    if (authTestResponse.status === 401 || authTestResponse.status === 403) {
      return c.json({ 
        success: false, 
        error: 'Authentication failed. Your app-specific password may have expired or been revoked. Please generate a new one at appleid.apple.com and reconnect.',
        hasTokens: true,
        hasCredentials: true,
        authValid: false,
        status: authTestResponse.status,
      }, 400);
    }

    // Accept 200 or 207 (Multi-Status) as success
    const authValid = authTestResponse.ok || authTestResponse.status === 207;
    
    if (!authValid) {
      const errorText = await authTestResponse.text();
      return c.json({ 
        success: false, 
        error: `CalDAV server error: ${authTestResponse.status} ${authTestResponse.statusText}`,
        hasTokens: true,
        hasCredentials: true,
        authValid: false,
        status: authTestResponse.status,
        details: errorText.substring(0, 200),
      }, 400);
    }

    // With shortcut method, we don't do complex discovery
    // Authentication success means we're ready to sync
    return c.json({
      success: true,
      hasTokens: true,
      hasCredentials: true,
      authValid: true,
      method: 'shortcut',
      message: 'Apple Calendar connected successfully. Authentication verified. Ready to sync tasks.',
    });
  } catch (error) {
    console.error('Apple Calendar test error:', error);
    return c.json({ 
      success: false, 
      error: getErrorMessage(error),
    }, 500);
  }
});

// Disconnect calendar
app.delete("/taskzm-database-function/calendar/:provider", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const provider = c.req.param('provider') as calendarSync.CalendarProvider;
    
    if (!['google', 'outlook', 'apple'].includes(provider)) {
      return c.json({ error: 'Invalid provider' }, 400);
    }

    // Remove tokens
    await kv.del(`user_${userId}_calendar_${provider}_tokens`);

    return c.json({ success: true });
  } catch (error) {
    console.log('Error disconnecting calendar:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Sync task to calendar
app.post("/taskzm-database-function/calendar/sync-task", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { task, provider, workspaceId } = await c.req.json();

    if (!task || !provider || !workspaceId) {
      return c.json({ error: 'Missing task, provider, or workspaceId' }, 400);
    }

    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Verify task belongs to this workspace
    const taskData = await kv.get(`workspace_${workspaceId}_task_${task.id}`);
    if (!taskData) {
      return c.json({ error: 'Task not found in workspace' }, 404);
    }

    // Check if task already has an event
    const existingEventId = await calendarSync.getTaskEventMapping(userId, task.id, provider);

    let event;
    if (existingEventId) {
      // Update existing event
      event = await calendarSync.updateCalendarEvent(userId, provider, existingEventId, task);
    } else {
      // Create new event
      event = await calendarSync.createCalendarEvent(userId, provider, task);
      if (event) {
        await calendarSync.storeTaskEventMapping(userId, task.id, provider, event.providerEventId);
      }
    }

    return c.json({ event });
  } catch (error) {
    console.log('Error syncing task to calendar:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Sync all tasks to calendar
app.post("/taskzm-database-function/calendar/sync-all", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Parse request body with error handling
    let workspaceId: string;
    let provider: string;
    try {
      const body = await c.req.json();
      workspaceId = body.workspaceId;
      provider = body.provider;
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return c.json({ error: 'Invalid request body. Please provide workspaceId and provider.' }, 400);
    }

    if (!workspaceId || !provider) {
      return c.json({ error: 'Missing workspaceId or provider' }, 400);
    }

    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Get all tasks with scheduled dates
    const tasksData = await kv.getByPrefix(`workspace_${workspaceId}_task_`);
    const tasks = tasksData
      .map(item => {
        // Handle both JSON strings and already-parsed objects
        if (typeof item.value === 'string') {
          // Skip if the string is "[object Object]" - this indicates a serialization error
          if (item.value === '[object Object]' || item.value.trim() === '[object Object]') {
            console.error(`Skipping invalid task value at ${item.key}: "[object Object]"`);
            return null;
          }
          try {
            const parsed = JSON.parse(item.value);
            // Ensure parsed value is an object
            if (typeof parsed === 'object' && parsed !== null) {
              return parsed;
            } else {
              console.error(`Task ${item.key} parsed to non-object:`, typeof parsed);
              return null;
            }
          } catch (parseError) {
            console.error(`Error parsing task ${item.key}:`, parseError);
            console.error(`Task value (first 200 chars):`, item.value.substring(0, 200));
            return null;
          }
        } else if (typeof item.value === 'object' && item.value !== null) {
          return item.value;
        }
        console.error(`Task ${item.key} has invalid type:`, typeof item.value);
        return null;
      })
      .filter(task => {
        // Filter out invalid tasks
        if (!task || task.archived) return false;
        // Must have either scheduledDate or dueDate
        const hasDate = task.scheduledDate || task.dueDate;
        if (!hasDate) {
          console.log(`Skipping task ${task.id}: no scheduledDate or dueDate`);
          return false;
        }
        // Validate date format
        const dateObj = new Date(hasDate);
        if (isNaN(dateObj.getTime())) {
          console.error(`Skipping task ${task.id}: invalid date format: ${hasDate}`);
          return false;
        }
        return true;
      });

    // Verify calendar tokens exist before attempting sync
    console.log(`Checking calendar tokens for user ${userId}, provider ${provider}...`);
    const tokens = await calendarSync.getCalendarTokens(userId, provider);
    if (!tokens) {
      const errorMsg = `No calendar tokens found for ${provider}. Please connect your ${provider} calendar first.`;
      console.error(errorMsg);
      return c.json({ error: errorMsg }, 400);
    }
    
    // Validate tokens based on provider
    if (provider === 'apple') {
      if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
        const errorMsg = `Apple Calendar credentials incomplete. Please reconnect your Apple Calendar.`;
        console.error(errorMsg);
        return c.json({ error: errorMsg }, 400);
      }
    } else {
      if (!tokens.accessToken) {
        const errorMsg = `Invalid tokens for ${provider}. Please reconnect your calendar.`;
        console.error(errorMsg);
        return c.json({ error: errorMsg }, 400);
      }
    }
    
    console.log(`Calendar tokens validated. Found ${tasks.length} tasks to sync.`);

    let syncedCount = 0;
    let failedCount = 0;
    const failedTaskIds: string[] = [];
    let firstError: string | null = null;
    
    for (const task of tasks) {
      try {
        console.log(`Syncing task ${task.id} to ${provider}...`, {
          taskId: task.id,
          taskTitle: task.title,
          scheduledDate: task.scheduledDate,
          provider,
        });
        
        const existingEventId = await calendarSync.getTaskEventMapping(userId, task.id, provider);
        
        let event;
        if (existingEventId) {
          console.log(`Updating existing event for task ${task.id}`);
          event = await calendarSync.updateCalendarEvent(userId, provider, existingEventId, task);
        } else {
          console.log(`Creating new event for task ${task.id}`);
          event = await calendarSync.createCalendarEvent(userId, provider, task);
          if (event) {
            console.log(`Event created successfully for task ${task.id}:`, event.providerEventId);
            await calendarSync.storeTaskEventMapping(userId, task.id, provider, event.providerEventId);
          } else {
            console.log(`Event creation returned null for task ${task.id}`);
          }
        }
        
        syncedCount++;
        console.log(`Successfully synced task ${task.id}`);
      } catch (error) {
        console.error(`Error syncing task ${task.id}:`, error);
        console.error('Error details:', {
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        if (!firstError) {
          firstError = getErrorMessage(error);
        }
        failedCount++;
        // Only store failed task IDs, not full error details to reduce response size
        if (failedTaskIds.length < 10) { // Limit to first 10 failures
          failedTaskIds.push(task.id);
        }
      }
    }

    // Return summary only (not full results) to reduce egress
    return c.json({ 
      synced: syncedCount,
      failed: failedCount,
      total: tasks.length,
      // Only include failed task IDs if there are failures (limited to 10)
      ...(failedTaskIds.length > 0 && { failedTaskIds }),
      ...(firstError && { failureReason: firstError })
    });
  } catch (error) {
    // Log full error details for debugging
    console.error('Error syncing all tasks - full error:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    const errorMessage = getErrorMessage(error);
    console.error('Returning error response:', errorMessage);
    return c.json({ error: errorMessage }, 500);
  }
});

// Get calendar events (returns 200 with events: [] on backend error so client can show other providers)
app.get("/taskzm-database-function/calendar/events/:provider", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const provider = c.req.param('provider') as calendarSync.CalendarProvider;
    const startDate = c.req.query('startDate') || new Date().toISOString();
    const endDate = c.req.query('endDate') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    let events: any[] = [];
    try {
      events = await calendarSync.getCalendarEvents(userId, provider, startDate, endDate);
    } catch (fetchError) {
      console.error(`Error fetching ${provider} calendar events (returning empty):`, fetchError);
      // Return 200 with empty events so client doesn't treat as fatal; other providers can still show
    }

    return c.json({ events });
  } catch (error) {
    console.log('Error in calendar events endpoint:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// APPLE CALENDAR SYNC VIA SHORTCUTS
// ============================================================================
// These endpoints are called by Apple Shortcuts for two-way calendar sync

// Get tasks to sync TO Apple Calendar (Shortcut calls this to fetch tasks)
app.get("/taskzm-database-function/calendar/apple/tasks", async (c) => {
  try {
    // Support both Bearer token auth and sync token auth
    let userId: string | null = null;
    
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const result = await verifyUser(c.req.raw);
      if (!result.error) {
        userId = result.userId;
      }
    }
    
    // Also check for sync token in query params (for Shortcuts)
    if (!userId) {
      const syncToken = c.req.query('token');
      if (syncToken) {
        try {
          const payload = JSON.parse(atob(syncToken));
          if (payload.type === 'calendar_sync' && payload.exp > Date.now()) {
            userId = payload.userId;
          }
        } catch {
          // Invalid token
        }
      }
    }
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const supabase = getSupabaseClient();
    
    // Get query parameters for filtering
    const startDate = c.req.query('startDate') || new Date().toISOString();
    const endDate = c.req.query('endDate') || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    
    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .single();
    
    if (!membership) {
      return c.json({ tasks: [] });
    }

    // Fetch scheduled tasks within the date range
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, title, description, scheduled_date, due_date, estimated_time, priority, status')
      .eq('workspace_id', membership.workspace_id)
      .neq('status', 'done')
      .not('scheduled_date', 'is', null)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('Error fetching tasks for Apple Calendar:', error);
      return c.json({ error: 'Failed to fetch tasks' }, 500);
    }

    // Transform to calendar-friendly format
    const calendarTasks = (tasks || []).map(task => {
      const startDate = new Date(task.scheduled_date);
      const durationMinutes = task.estimated_time || 30;
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
      
      return {
        id: task.id,
        title: task.title,
        notes: task.description || '',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        priority: task.priority,
      };
    });

    return c.json({ 
      tasks: calendarTasks,
      count: calendarTasks.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in Apple Calendar tasks endpoint:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Receive events FROM Apple Calendar (Shortcut sends events here)
app.post("/taskzm-database-function/calendar/apple/events", async (c) => {
  try {
    // Parse body once (consumable only once)
    const body = await c.req.json().catch(() => ({}));
    const events = Array.isArray(body?.events) ? body.events : [];

    // Support both Bearer token auth and sync token auth
    let userId: string | null = null;

    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const result = await verifyUser(c.req.raw);
      if (!result.error) {
        userId = result.userId;
      }
    }

    // Also check for sync token in body or query (for Shortcuts)
    if (!userId) {
      const syncToken = body.token || c.req.query('token');
      if (syncToken) {
        try {
          const payload = JSON.parse(atob(syncToken));
          if (payload.type === 'calendar_sync' && payload.exp > Date.now()) {
            userId = payload.userId;
          }
        } catch {
          // Invalid token
        }
      }
    }

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const supabase = getSupabaseClient();
    
    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .single();
    
    if (!membership) {
      return c.json({ error: 'No workspace found' }, 400);
    }

    let created = 0;
    let updated = 0;
    let errors = 0;

    // Use full start datetime when available so tasks are scheduled at the same time as the calendar event.
    const getScheduledDate = (event: { start?: string; startDate?: string; startTime?: string }): string => {
      const fullStart = event.start ?? event.startDate;
      if (!fullStart || typeof fullStart !== 'string') return event.startDate || new Date().toISOString();
      const trimmed = fullStart.trim();
      if (/^\d{4}-\d{2}-\d{2}T\d/.test(trimmed)) {
        return trimmed.endsWith('Z') || /[-+]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : trimmed + 'Z';
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && event.startTime && typeof event.startTime === 'string') {
        const t = event.startTime.trim();
        const match = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (match) {
          const [, h, m, s] = match;
          const time = `${h!.padStart(2, '0')}:${m}:${(s || '00').padStart(2, '0')}`;
          return `${trimmed}T${time}Z`;
        }
      }
      return event.startDate ?? fullStart;
    };

    for (const event of events) {
      try {
        const scheduledDate = getScheduledDate(event);

        // Check if this event already exists as a task (by calendar_event_id)
        const { data: existingTask } = await supabase
          .from('tasks')
          .select('id')
          .eq('workspace_id', membership.workspace_id)
          .eq('calendar_event_id', event.id)
          .single();

        if (existingTask) {
          // Update existing task
          const { error: updateError } = await supabase
            .from('tasks')
            .update({
              title: event.title,
              description: event.notes || null,
              scheduled_date: scheduledDate,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingTask.id);

          if (updateError) {
            console.error('Error updating task from calendar event:', updateError);
            errors++;
          } else {
            updated++;
          }
        } else {
          // Create new task from calendar event
          const { error: insertError } = await supabase
            .from('tasks')
            .insert({
              workspace_id: membership.workspace_id,
              title: event.title,
              description: event.notes || null,
              scheduled_date: scheduledDate,
              status: 'todo',
              priority: 'medium',
              calendar_event_id: event.id,
              calendar_source: 'apple',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Error creating task from calendar event:', insertError);
            errors++;
          } else {
            created++;
          }
        }
      } catch (eventError) {
        console.error('Error processing calendar event:', eventError);
        errors++;
      }
    }

    return c.json({
      success: true,
      created,
      updated,
      errors,
      total: events.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in Apple Calendar events endpoint:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Generate a sync token for Apple Shortcuts
app.get("/taskzm-database-function/calendar/apple/sync-token", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Generate a long-lived token for the shortcut
    const payload = {
      userId,
      type: 'calendar_sync',
      exp: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 days
    };
    const token = btoa(JSON.stringify(payload));

    // Get the API base URL
    const baseUrl = Deno.env.get('SUPABASE_URL') || '';
    const apiUrl = `${baseUrl}/functions/v1/taskzm-database-function`;

    return c.json({
      token,
      expiresAt: new Date(payload.exp).toISOString(),
      endpoints: {
        getTasks: `${apiUrl}/calendar/apple/tasks?token=${token}`,
        postEvents: `${apiUrl}/calendar/apple/events?token=${token}`,
      },
      instructions: 'Use these URLs in your Apple Shortcut to sync calendar events with TaskZM.',
    });
  } catch (error) {
    console.error('Error generating sync token:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// APPLE CALDAV IMPORT (One-Way Sync: iCloud → TaskZM)
// ============================================================================
// Import events from Apple iCloud Calendar into TaskZM as read-only items

// Test CalDAV connection with credentials (register both path formats for compatibility)
const appleCalDAVTestHandler = async (c: any) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { email, appPassword } = await c.req.json();
    
    if (!email || !appPassword) {
      return c.json({ error: 'Email and app-specific password are required' }, 400);
    }

    const result = await appleCaldavSync.testConnection({ email, appPassword });
    
    return c.json(result);
  } catch (error) {
    console.error('CalDAV test connection error:', error);
    return c.json({ 
      success: false, 
      message: getErrorMessage(error)
    }, 500);
  }
};
app.post("/taskzm-database-function/calendar/apple/caldav/test", appleCalDAVTestHandler);
app.post("/calendar/apple/caldav/test", appleCalDAVTestHandler);

// Discover calendars (register both path formats)
const appleCalDAVDiscoverHandler = async (c: any) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { email, appPassword } = await c.req.json();
    
    if (!email || !appPassword) {
      return c.json({ error: 'Email and app-specific password are required' }, 400);
    }

    const calendars = await appleCaldavSync.discoverCalendars({ email, appPassword });
    
    return c.json({ 
      success: true,
      calendars 
    });
  } catch (error) {
    console.error('CalDAV discover calendars error:', error);
    return c.json({ 
      success: false,
      error: getErrorMessage(error) 
    }, 500);
  }
};
app.post("/taskzm-database-function/calendar/apple/caldav/discover", appleCalDAVDiscoverHandler);
app.post("/calendar/apple/caldav/discover", appleCalDAVDiscoverHandler);

// Save CalDAV credentials and selected calendars (register both path formats)
const appleCalDAVSaveHandler = async (c: any) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { email, appPassword, selectedCalendars } = await c.req.json();
    
    if (!email || !appPassword) {
      return c.json({ error: 'Email and app-specific password are required' }, 400);
    }

    await kv.set(`caldav_credentials_${userId}`, JSON.stringify({
      email,
      appPassword,
      selectedCalendars: selectedCalendars || [],
      connectedAt: new Date().toISOString(),
    }));

    return c.json({ 
      success: true,
      message: 'CalDAV credentials saved successfully'
    });
  } catch (error) {
    console.error('CalDAV save credentials error:', error);
    return c.json({ 
      success: false,
      error: getErrorMessage(error) 
    }, 500);
  }
};
app.post("/taskzm-database-function/calendar/apple/caldav/save", appleCalDAVSaveHandler);
app.post("/calendar/apple/caldav/save", appleCalDAVSaveHandler);

// Get CalDAV connection status
app.get("/taskzm-database-function/calendar/apple/caldav/status", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const credentialsJson = await kv.get(`caldav_credentials_${userId}`);
    
    if (!credentialsJson) {
      return c.json({ 
        connected: false,
        selectedCalendars: []
      });
    }

    const credentials = JSON.parse(credentialsJson);
    
    // Get last sync info
    const lastSyncJson = await kv.get(`caldav_last_sync_${userId}`);
    const lastSync = lastSyncJson ? JSON.parse(lastSyncJson) : null;

    return c.json({ 
      connected: true,
      email: credentials.email,
      selectedCalendars: credentials.selectedCalendars || [],
      connectedAt: credentials.connectedAt,
      lastSync: lastSync,
    });
  } catch (error) {
    console.error('CalDAV status error:', error);
    return c.json({ 
      connected: false,
      error: getErrorMessage(error) 
    }, 500);
  }
});

// Apple CalDAV sync handler (shared for both path formats so sync works regardless of how Supabase forwards the path)
const appleCalDAVSyncHandler = async (c: any) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's timezone from request body (auto-detected from browser)
    let userTimezone = 'America/New_York'; // Default fallback
    try {
      const body = await c.req.json();
      console.log('Sync request body:', JSON.stringify(body));
      if (body?.userTimezone) {
        userTimezone = body.userTimezone;
        console.log(`Using user timezone: ${userTimezone}`);
      } else {
        console.log('No userTimezone in body, using default:', userTimezone);
      }
    } catch (error) {
      // No body or invalid JSON - use default timezone
      console.log('Error parsing request body, using default timezone:', error);
    }

    // Ensure user has a workspace (create if missing)
    const workspaceId = await ensureUserWorkspace(userId);

    // Resolve credentials and selected calendar hrefs
    let credentials: { email: string; appPassword: string };
    let selectedCalendarHrefs: string[];

    const credentialsRaw = await kv.get(`caldav_credentials_${userId}`);
    if (credentialsRaw) {
      const storedCredentials = typeof credentialsRaw === 'string' ? JSON.parse(credentialsRaw) : credentialsRaw;
      if (!storedCredentials.email || !storedCredentials.appPassword) {
        return c.json({ error: 'CalDAV credentials incomplete. Please reconnect your Apple Calendar.' }, 400);
      }
      credentials = { email: storedCredentials.email, appPassword: storedCredentials.appPassword };
      if (storedCredentials.selectedCalendars && storedCredentials.selectedCalendars.length > 0) {
        selectedCalendarHrefs = storedCredentials.selectedCalendars.map((cal: any) => cal.href);
      } else {
        // Saved credentials but no calendars selected – discover and use all
        console.log('CalDAV credentials found but no calendars selected; discovering calendars');
        const discovered = await appleCaldavSync.discoverCalendars(credentials);
        selectedCalendarHrefs = discovered.map((cal) => cal.href);
        if (selectedCalendarHrefs.length === 0) {
          return c.json({ error: 'No calendars found. Please check your iCloud account.' }, 400);
        }
        // Persist selection for next time
        await kv.set(`caldav_credentials_${userId}`, JSON.stringify({
          ...storedCredentials,
          selectedCalendars: discovered,
        }));
      }
    } else {
      // Fall back to legacy Apple tokens (shortcut /calendar/apple/setup flow)
      const appleTokens = await calendarSync.getCalendarTokens(userId, 'apple');
      if (!appleTokens?.caldavUsername || !appleTokens?.caldavPassword) {
        return c.json({ error: 'CalDAV not configured. Please connect your Apple Calendar first.' }, 400);
      }
      credentials = { email: appleTokens.caldavUsername, appPassword: appleTokens.caldavPassword };
      const discovered = await appleCaldavSync.discoverCalendars(credentials);
      selectedCalendarHrefs = discovered.map((cal) => cal.href);
      if (selectedCalendarHrefs.length === 0) {
        return c.json({ error: 'No calendars found. Please check your iCloud account.' }, 400);
      }
      // Migrate to CalDAV credentials so future syncs use selectedCalendars
      await kv.set(`caldav_credentials_${userId}`, JSON.stringify({
        email: credentials.email,
        appPassword: credentials.appPassword,
        selectedCalendars: discovered,
      }));
      console.log('Migrated legacy Apple tokens to CalDAV credentials; syncing all discovered calendars');
    }

    const supabase = getSupabaseClient();
    const result = await appleCaldavSync.syncCalendarsToDatabase(
      supabase,
      userId,
      workspaceId,
      credentials,
      selectedCalendarHrefs,
      userTimezone
    );

    // If sync corrected stored calendar list (e.g. removed calendar-home URL), persist for next time
    if (result.correctedCalendars && result.correctedCalendars.length > 0) {
      const credentialsRaw = await kv.get(`caldav_credentials_${userId}`);
      if (credentialsRaw) {
        const stored = typeof credentialsRaw === 'string' ? JSON.parse(credentialsRaw) : credentialsRaw;
        await kv.set(`caldav_credentials_${userId}`, JSON.stringify({
          ...stored,
          selectedCalendars: result.correctedCalendars,
        }));
        console.log('[CalDAV] Persisted corrected calendar selection');
      }
    }

    await kv.set(`caldav_last_sync_${userId}`, JSON.stringify({
      syncedAt: new Date().toISOString(),
      ...result,
    }));

    // Frontend expects either data.error or data.errors; when success is false, set error from errors array
    const payload = result.success
      ? result
      : { ...result, error: result.errors?.length ? result.errors.join(' ') : 'Apple Calendar sync failed' };
    return c.json(payload);
  } catch (error) {
    console.error('CalDAV sync error:', error);
    return c.json({
      success: false,
      error: getErrorMessage(error),
    }, 500);
  }
};

app.post("/taskzm-database-function/calendar/apple/caldav/sync", appleCalDAVSyncHandler);
app.post("/calendar/apple/caldav/sync", appleCalDAVSyncHandler);

// Disconnect CalDAV
app.delete("/taskzm-database-function/calendar/apple/caldav", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Delete stored credentials
    await kv.del(`caldav_credentials_${userId}`);
    await kv.del(`caldav_last_sync_${userId}`);

    // Optionally delete synced events
    const supabase = getSupabaseClient();
    await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'icloud');

    return c.json({ 
      success: true,
      message: 'Apple Calendar disconnected'
    });
  } catch (error) {
    console.error('CalDAV disconnect error:', error);
    return c.json({ 
      success: false,
      error: getErrorMessage(error) 
    }, 500);
  }
});

// Get synced calendar events
app.get("/taskzm-database-function/calendar/apple/caldav/events", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const startDate = c.req.query('startDate') || new Date().toISOString();
    const endDate = c.req.query('endDate') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const supabase = getSupabaseClient();
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'icloud')
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return c.json({ 
      events: events || [],
      count: events?.length || 0
    });
  } catch (error) {
    console.error('CalDAV get events error:', error);
    return c.json({ 
      events: [],
      error: getErrorMessage(error) 
    }, 500);
  }
});

// ============================================================================
// STRIPE CHECKOUT SESSION
// ============================================================================
// Create Stripe checkout session for subscription purchases

app.post("/taskzm-database-function/create-checkout-session", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    
    if (!stripeSecretKey) {
      console.error('Stripe not configured - STRIPE_SECRET_KEY missing');
      return c.json({ error: 'Payment provider not configured' }, 500);
    }

    const { priceId } = await c.req.json();
    
    if (!priceId || (priceId !== 'monthly' && priceId !== 'yearly')) {
      return c.json({ error: 'Invalid price ID. Must be "monthly" or "yearly"' }, 400);
    }

    // Map priceId to Stripe Price ID from environment variables
    // These should be set in your environment: STRIPE_PRICE_ID_MONTHLY and STRIPE_PRICE_ID_YEARLY
    const monthlyPriceId = Deno.env.get('STRIPE_PRICE_ID_MONTHLY');
    const yearlyPriceId = Deno.env.get('STRIPE_PRICE_ID_YEARLY');
    
    const selectedPriceId = priceId === 'monthly' ? monthlyPriceId : yearlyPriceId;
    
    if (!selectedPriceId) {
      console.error(`Stripe price ID not configured for ${priceId} subscription`);
      return c.json({ 
        error: `Subscription pricing not configured. Please set STRIPE_PRICE_ID_${priceId.toUpperCase()} in environment variables.` 
      }, 500);
    }

    // Ensure APP_URL uses HTTPS for security
    let appUrl = Deno.env.get('APP_URL') || 'https://taskzm.app';
    // Force HTTPS if not already present
    if (!appUrl.startsWith('https://')) {
      appUrl = appUrl.replace(/^https?:\/\//, 'https://');
    }
    
    // Logo URL - must be publicly accessible HTTPS URL
    const logoUrl = `${appUrl}/taskzm-logo.png`;
    
    // Create Stripe checkout session with improved security and appearance configuration
    // Note: Stripe Checkout is always served over HTTPS, which enables autofill
    const checkoutParams = new URLSearchParams({
      'mode': 'subscription',
      'payment_method_types[]': 'card',
      'line_items[0][price]': selectedPriceId,
      'line_items[0][quantity]': '1',
      'customer_email': '', // Will be collected in checkout form
      'success_url': `${appUrl}/settings?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${appUrl}/settings?canceled=true`,
      'metadata[userId]': userId,
      'metadata[priceId]': priceId,
      // Billing address collection - 'auto' allows pre-fill while maintaining security
      'billing_address_collection': 'auto',
      // Payment method collection - always collect payment method
      'payment_method_collection': 'always',
      // Logo for checkout page (must be publicly accessible HTTPS URL)
      'images[]': logoUrl,
      // Enable customer creation for better security and autofill support
      'customer_creation': 'always',
      // Appearance customization for better UX
      // Note: Additional styling should be configured in Stripe Dashboard → Settings → Branding
      'ui_mode': 'hosted', // Use hosted checkout (best for security and autofill)
      'consent_collection': 'if_required', // Only show consent if required by regulations
      // Allow promotion codes for discounts
      'allow_promotion_codes': 'true',
      // Submit type - use 'pay' for subscriptions (shows "Subscribe" instead of "Pay")
      'submit_type': 'pay',
    });
    
    // Only enable automatic tax if configured in Stripe account
    // This is optional and requires Stripe Tax to be set up
    const enableAutomaticTax = Deno.env.get('STRIPE_ENABLE_AUTOMATIC_TAX') === 'true';
    if (enableAutomaticTax) {
      checkoutParams.append('automatic_tax[enabled]', 'true');
    }
    
    // Phone number collection is optional - enable if needed for verification
    const enablePhoneCollection = Deno.env.get('STRIPE_COLLECT_PHONE') === 'true';
    if (enablePhoneCollection) {
      checkoutParams.append('phone_number_collection[enabled]', 'true');
    }
    
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: checkoutParams,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Stripe checkout session error:', error);
      return c.json({ error: 'Failed to create checkout session' }, 500);
    }

    const session = await response.json();
    
    return c.json({ 
      url: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// REVENUECAT WEBHOOK
// ============================================================================
// Handle RevenueCat webhook events for subscription updates

app.post("/taskzm-database-function/revenuecat-webhook", async (c) => {
  try {
    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      console.error('RevenueCat webhook secret not configured');
      return c.json({ error: 'Webhook not configured' }, 500);
    }

    // Check Authorization header - RevenueCat sends it as "Bearer {secret}"
    const authHeader = c.req.header('Authorization');
    
    // Verify webhook signature (RevenueCat sends Authorization header with secret)
    if (!authHeader) {
      console.error('Missing Authorization header in RevenueCat webhook');
      console.error('Request headers:', Object.fromEntries(c.req.raw.headers.entries()));
      return c.json({ code: 401, message: "Auth header is not 'Bearer {token}'" }, 401);
    }

    // Extract token from "Bearer {token}" format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7).trim() 
      : authHeader.trim();
    
    if (token !== webhookSecret) {
      console.error('Invalid RevenueCat webhook signature. Expected:', webhookSecret.substring(0, 4) + '...', 'Got:', token.substring(0, 4) + '...');
      return c.json({ code: 401, message: "Auth header is not 'Bearer {token}'" }, 401);
    }

    // Parse request body with better error handling
    let event;
    try {
      const bodyText = await c.req.text();
      if (!bodyText || bodyText.trim() === '') {
        console.error('Empty request body in RevenueCat webhook');
        return c.json({ error: 'Empty request body' }, 400);
      }
      
      event = JSON.parse(bodyText);
      console.log('📥 RevenueCat webhook received:', {
        hasEvent: !!event.event,
        eventType: event.event?.type || event.type,
        hasAppUserId: !!(event.event?.app_user_id || event.app_user_id || event.original_app_user_id),
        bodyLength: bodyText.length,
      });
    } catch (parseError) {
      console.error('Failed to parse RevenueCat webhook JSON:', parseError);
      return c.json({ error: 'Invalid JSON in request body', details: getErrorMessage(parseError) }, 400);
    }
    
    // Extract user ID from event (handle both nested and flat event structures)
    const userId = event.event?.app_user_id || event.app_user_id || event.original_app_user_id;
    
    if (!userId) {
      console.error('No user ID in RevenueCat webhook event:', JSON.stringify(event, null, 2));
      return c.json({ error: 'Missing user ID' }, 400);
    }

    // Handle different event types
    const eventType = event.event?.type || event.type;
    
    console.log(`📥 RevenueCat webhook: ${eventType} for user ${userId}`);

    // Extract entitlement information from event
    // RevenueCat can send entitlements in different formats:
    // 1. event.event.entitlement_ids (array) - most common
    // 2. event.entitlement_ids (array) - flat structure
    // 3. event.event.entitlements.active (object) - legacy format
    // 4. event.entitlements.active (object) - legacy format
    const entitlementIds = Array.isArray(event.event?.entitlement_ids) 
      ? event.event.entitlement_ids 
      : Array.isArray(event.entitlement_ids) 
        ? event.entitlement_ids 
        : [];
    const entitlements = event.event?.entitlements || event.entitlements || {};
    
    // Log full event structure for debugging (but limit size to prevent log overflow)
    const logEvent = {
      hasEvent: !!event.event,
      hasEntitlementIds: entitlementIds.length > 0,
      entitlementIdsCount: entitlementIds.length,
      entitlementIds: entitlementIds.slice(0, 5), // Only log first 5
      hasEntitlements: !!Object.keys(entitlements).length,
      eventType,
      productId: event.event?.product_id || event.product_id,
    };
    console.log('📋 RevenueCat webhook event structure:', JSON.stringify(logEvent));
    
    // Check if user has any pro entitlement
    // Entitlement IDs can be: "Yearly", "PRO-Yearly", "PRO-Monthly", "pro", etc.
    const hasProEntitlement = 
      (Array.isArray(entitlementIds) && entitlementIds.length > 0 && entitlementIds.some((id: string) => {
        if (typeof id !== 'string') return false;
        const lowerId = id.toLowerCase();
        return lowerId.includes('yearly') || 
               lowerId.includes('monthly') || 
               lowerId === 'pro' ||
               lowerId.includes('lifetime');
      })) ||
      entitlements.active?.['pro'] ||
      entitlements.active?.['PRO-Monthly'] ||
      entitlements.active?.['PRO-Yearly'] ||
      entitlements.active?.['Yearly'];

    const tier = hasProEntitlement ? 'pro' : 'free';
    
    // Get subscription details from event (prefer nested structure)
    const eventData = event.event || event;
    
    // Handle different event types
    let status = 'inactive';
    let startDate = null;
    let endDate = null;
    let cancelAtPeriodEnd = false;
    
    if (eventType === 'NON_RENEWING_PURCHASE' || eventType === 'INITIAL_PURCHASE') {
      // For non-renewing purchases (like lifetime subscriptions), check expiration
      const expirationAtMs = eventData.expiration_at_ms || event.expiration_at_ms;
      const productId = eventData.product_id || event.product_id || '';
      const isLifetimeProduct = productId.toLowerCase().includes('lifetime') || 
                                productId.toLowerCase().includes('promo');
      
      console.log(`📦 NON_RENEWING_PURCHASE event details:`, {
        expirationAtMs,
        productId,
        isLifetimeProduct,
        periodType: eventData.period_type || event.period_type,
        store: eventData.store || event.store,
      });
      
      if (expirationAtMs) {
        const expirationDate = new Date(expirationAtMs);
        const now = new Date();
        
        // Check if it's a lifetime subscription (expiration far in the future, e.g., > 100 years)
        const yearsUntilExpiration = (expirationAtMs - now.getTime()) / (1000 * 60 * 60 * 24 * 365);
        
        if (yearsUntilExpiration > 100) {
          // Lifetime subscription - treat as active with no expiration
          status = 'active';
          endDate = null; // No expiration for lifetime
          console.log('🔓 Lifetime subscription detected (expires in', Math.round(yearsUntilExpiration), 'years)');
        } else if (expirationDate > now) {
          status = 'active';
          endDate = expirationDate.toISOString();
        } else {
          status = 'expired';
          endDate = expirationDate.toISOString();
        }
      } else {
        // No expiration date - assume lifetime subscription (common for promotional/lifetime products)
        status = 'active';
        endDate = null;
        console.log(`🔓 Lifetime subscription detected (no expiration date) - Product: ${productId}, Store: ${eventData.store || event.store || 'unknown'}`);
      }
      
      const purchasedAtMs = eventData.purchased_at_ms || event.purchased_at_ms;
      if (purchasedAtMs) {
        startDate = new Date(purchasedAtMs).toISOString();
        console.log(`📅 Subscription start date: ${startDate} (from purchased_at_ms: ${purchasedAtMs})`);
      } else {
        console.warn('⚠️ No purchased_at_ms found in NON_RENEWING_PURCHASE event');
      }
    } else if (eventType === 'RENEWAL' || eventType === 'CANCELLATION' || eventType === 'UNCANCELLATION') {
      // For renewal/cancellation events, try to extract from entitlements
      const subscription = entitlements.active?.['pro'] ||
                          entitlements.active?.['PRO-Monthly'] ||
                          entitlements.active?.['PRO-Yearly'] ||
                          entitlements.active?.['Yearly'];
      
      if (subscription) {
        status = subscription.will_renew ? 'active' : 
                 subscription.expires_date ? 'expired' : 'inactive';
        startDate = subscription.purchase_date || null;
        endDate = subscription.expires_date || null;
        cancelAtPeriodEnd = !subscription.will_renew;
      } else if (hasProEntitlement) {
        // If we have entitlements but no subscription object, check expiration from event
        const expirationAtMs = eventData.expiration_at_ms || event.expiration_at_ms;
        if (expirationAtMs) {
          const expirationDate = new Date(expirationAtMs);
          const now = new Date();
          status = expirationDate > now ? 'active' : 'expired';
          endDate = expirationDate.toISOString();
        } else {
          status = 'active';
        }
      }
    } else {
      // For other event types, check if entitlements exist
      if (hasProEntitlement) {
        const expirationAtMs = eventData.expiration_at_ms || event.expiration_at_ms;
        if (expirationAtMs) {
          const expirationDate = new Date(expirationAtMs);
          const now = new Date();
          status = expirationDate > now ? 'active' : 'expired';
          endDate = expirationDate.toISOString();
        } else {
          status = 'active';
        }
        
        const purchasedAtMs = eventData.purchased_at_ms || event.purchased_at_ms;
        if (purchasedAtMs) {
          startDate = new Date(purchasedAtMs).toISOString();
        }
      }
    }

    // Determine subscription store
    const store = eventData.store || event.store || 'revenuecat';

    // Save subscription data
    const subscriptionData = {
      tier,
      status,
      startDate,
      endDate,
      cancelAtPeriodEnd,
    };

    // Save in both formats for compatibility with error handling
    try {
      await kv.set(`user_${userId}_subscription`, subscriptionData);
      await kv.set(`user:${userId}:tier`, tier);
      await kv.set(`user:${userId}:subscription_status`, status);
      await kv.set(`user:${userId}:subscription_store`, store);
      if (startDate) {
        await kv.set(`user:${userId}:subscription_start`, startDate);
      }
      if (endDate) {
        await kv.set(`user:${userId}:subscription_expires_at`, endDate);
      }
    } catch (kvError) {
      console.error('❌ Failed to save subscription data to KV store:', kvError);
      // Continue execution but log the error - we still want to return success to RevenueCat
      // to prevent retries, but log the issue for debugging
    }

    console.log(`✅ RevenueCat webhook processed: ${eventType} - User ${userId} -> ${tier} (${status})`);
    console.log(`   Entitlements: ${JSON.stringify(entitlementIds.slice(0, 10))}`); // Limit log size
    console.log(`   Store: ${store}, Start: ${startDate}, End: ${endDate}`);
    console.log(`   Subscription Data:`, JSON.stringify(subscriptionData));

    return c.json({ 
      success: true, 
      event: eventType, 
      tier, 
      status,
      userId,
      subscription: subscriptionData, // Include full subscription data for verification
      entitlements: entitlementIds,
      store,
    });
  } catch (error) {
    console.error('❌ RevenueCat webhook error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const errorMessage = getErrorMessage(error);
    return c.json({ 
      error: errorMessage,
      code: 500,
      message: 'Internal server error processing webhook'
    }, 500);
  }
});

// ============================================================================
// STRIPE WEBHOOK (if needed in the future)
// ============================================================================
// Stripe webhook endpoint can be added here for handling Stripe subscription events

// Get user subscription status (for frontend queries)
app.get("/taskzm-database-function/subscription-status", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if this is a demo user - demo users always get Pro tier (yearly)
    const isDemoFlag = await kv.get(`user_${userId}_is_demo`);
    const isDemo = isDemoFlag === 'true';

    // Get subscription data from kv store (webhook format)
    let tier = await kv.get(`user:${userId}:tier`) || 'free';
    let status = await kv.get(`user:${userId}:subscription_status`) || 'none';
    let store = await kv.get(`user:${userId}:subscription_store`);
    let startDate = await kv.get(`user:${userId}:subscription_start`);
    const expiresAt = await kv.get(`user:${userId}:subscription_expires_at`);
    let billingPeriod = await kv.get(`user:${userId}:billing_period`);
    const cancelAtPeriodEnd = status === 'cancelled' && expiresAt && new Date(expiresAt) > new Date();

    // Also check legacy format for backwards compatibility
    const legacySubscription = await kv.get(`user_${userId}_subscription`);
    
    // If demo user, ensure they have Pro tier with yearly billing
    if (isDemo) {
      // Override subscription for demo users to ensure they always have full access
      tier = 'pro';
      status = 'active';
      store = 'demo_account';
      billingPeriod = 'yearly';
      
      // Set start date if not already set
      if (!startDate) {
        startDate = new Date().toISOString();
        await kv.set(`user:${userId}:subscription_start`, startDate);
      }
      
      // Ensure subscription data is stored correctly for demo users
      if (tier !== 'pro' || billingPeriod !== 'yearly' || status !== 'active') {
        console.log(`🔧 Fixing subscription status for demo user ${userId}: Ensuring Pro tier (yearly)`);
        
        // Update subscription in both formats
        const demoSubscription = {
          tier: 'pro',
          status: 'active',
          startDate: startDate || new Date().toISOString(),
          endDate: null, // Demo accounts don't expire
          cancelAtPeriodEnd: false,
          billingPeriod: 'yearly',
        };
        
        await kv.set(`user_${userId}_subscription`, demoSubscription);
        await kv.set(`user:${userId}:tier`, 'pro');
        await kv.set(`user:${userId}:subscription_status`, 'active');
        await kv.set(`user:${userId}:subscription_store`, 'demo_account');
        await kv.set(`user:${userId}:subscription_start`, demoSubscription.startDate);
        await kv.set(`user:${userId}:billing_period`, 'yearly');
        
        console.log(`✅ Demo user ${userId} subscription status fixed: Pro tier (yearly)`);
      }
    }
    
    // Merge data - prefer webhook format if available
    const subscriptionData = {
      tier: tier !== 'free' ? tier : (legacySubscription?.tier || 'free'),
      status: status !== 'none' ? status : (legacySubscription?.status || 'active'),
      store: store || legacySubscription?.store,
      startDate: startDate || legacySubscription?.startDate,
      endDate: expiresAt || legacySubscription?.endDate,
      cancelAtPeriodEnd: cancelAtPeriodEnd || legacySubscription?.cancelAtPeriodEnd || false,
      billingPeriod: billingPeriod || legacySubscription?.billingPeriod || null,
      isPro: tier === 'pro' || legacySubscription?.tier === 'pro'
    };

    return c.json(subscriptionData);
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// ADMIN: SYNC REVENUECAT SUBSCRIPTIONS
// ============================================================================
// Admin endpoint to verify and sync subscription data
// Note: RevenueCat webhooks automatically sync subscriptions when events occur
// This endpoint allows admins to verify subscription data is correct

app.post("/taskzm-database-function/admin/sync-subscriptions", async (c) => {
  try {
    const { userId, error: authError } = await verifyAdmin(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    const { userEmail, userId: targetUserId } = await c.req.json();
    
    // Helper function to find user ID by email
    const findUserIdByEmail = async (email: string): Promise<string | null> => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.admin.listUsers();
        if (error) return null;
        const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        return user?.id || null;
      } catch {
        return null;
      }
    };
    
    // If specific user provided, verify their subscription data
    if (userEmail || targetUserId) {
      const userIdToSync = targetUserId || (userEmail ? await findUserIdByEmail(userEmail) : null);
      
      if (!userIdToSync) {
        return c.json({ error: 'User not found' }, 404);
      }

      // Get current subscription data from both formats
      const tier = await kv.get(`user:${userIdToSync}:tier`) || 'free';
      const status = await kv.get(`user:${userIdToSync}:subscription_status`) || 'none';
      const store = await kv.get(`user:${userIdToSync}:subscription_store`);
      const startDate = await kv.get(`user:${userIdToSync}:subscription_start`);
      const expiresAt = await kv.get(`user:${userIdToSync}:subscription_expires_at`);
      const billingPeriod = await kv.get(`user:${userIdToSync}:billing_period`);
      const legacySubscription = await kv.get(`user_${userIdToSync}_subscription`);

      // Check for data consistency
      const webhookTier = tier;
      const legacyTier = legacySubscription?.tier || 'free';
      const finalTier = webhookTier !== 'free' ? webhookTier : legacyTier;
      
      const webhookStatus = status;
      const legacyStatus = legacySubscription?.status || 'active';
      const finalStatus = webhookStatus !== 'none' ? webhookStatus : legacyStatus;

      const hasInconsistency = 
        (webhookTier !== 'free' && legacyTier !== 'free' && webhookTier !== legacyTier) ||
        (webhookStatus !== 'none' && legacyStatus !== 'active' && webhookStatus !== legacyStatus);

      return c.json({
        success: true,
        userId: userIdToSync,
        subscription: {
          tier: finalTier,
          status: finalStatus,
          store: store || legacySubscription?.store,
          startDate: startDate || legacySubscription?.startDate,
          endDate: expiresAt || legacySubscription?.endDate,
          billingPeriod: billingPeriod || legacySubscription?.billingPeriod,
        },
        dataFormats: {
          webhook: { tier: webhookTier, status: webhookStatus },
          legacy: { tier: legacyTier, status: legacyStatus },
        },
        hasInconsistency,
        message: hasInconsistency 
          ? 'Data inconsistency detected - webhook and legacy formats differ'
          : 'Subscription data is consistent (RevenueCat webhooks automatically sync when events occur)',
      });
    }

    // If no specific user, return summary
    return c.json({
      success: true,
      message: 'Use userEmail or userId parameter to verify specific user. RevenueCat webhooks automatically sync subscriptions when events occur.',
    });
  } catch (error) {
    console.error('❌ Admin sync error:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// STRIPE BILLING PORTAL
// ============================================================================
// Create Stripe billing portal session for subscription management

app.post("/taskzm-database-function/create-billing-portal", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    
    if (!stripeSecretKey) {
      console.error('Stripe not configured - STRIPE_SECRET_KEY missing');
      return c.json({ error: 'Payment provider not configured' }, 500);
    }

    // Check subscription store first - only Stripe subscriptions can use billing portal
    const subscriptionStore = await kv.get(`user:${userId}:subscription_store`);
    
    // If subscription is from App Store or Play Store, redirect to appropriate store
    if (subscriptionStore === 'app_store' || subscriptionStore === 'play_store') {
      return c.json({ 
        error: 'This subscription is managed through the App Store or Play Store. Please manage it through your device\'s subscription settings.',
        store: subscriptionStore 
      }, 400);
    }
    
    // Get user's Stripe customer ID from KV store
    let stripeCustomerId = await kv.get(`user:${userId}:stripe_customer_id`);
    
    // If customer ID not stored, check subscription data from database
    if (!stripeCustomerId) {
      // Check if user has an active subscription in the database
      const subscriptionData = await kv.get(`user_${userId}_subscription`);
      if (subscriptionData && subscriptionData.tier === 'pro' && subscriptionData.status === 'active') {
        // User has Pro subscription but no Stripe customer ID stored
        // This might be from a different payment method or needs to be set up
        console.warn(`User ${userId} has Pro subscription but no Stripe customer ID stored`);
      }
    }
    
    if (!stripeCustomerId) {
      return c.json({ error: 'No Stripe subscription found. Please subscribe to Pro to access billing management.' }, 404);
    }

    // Create billing portal session
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'customer': stripeCustomerId,
        'return_url': `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/settings`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Stripe billing portal error:', error);
      return c.json({ error: 'Failed to create billing portal session' }, 500);
    }

    const session = await response.json();
    
    return c.json({ 
      url: session.url 
    });
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================
// Admin endpoint to set a user as admin and/or pro
app.post("/taskzm-database-function/admin/set-user-access", async (c) => {
  try {
    const { userId: adminUserId, error: authError } = await verifyAdmin(c.req.raw);
    if (authError || !adminUserId) {
      return c.json({ error: authError || 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { email, role, tier } = body;

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Get Supabase client
    const supabase = getSupabaseClient();
    
    // Find user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return c.json({ error: 'Failed to find user' }, 500);
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return c.json({ error: `User with email ${email} not found` }, 404);
    }

    const userId = user.id;
    const updates = [];

    // Update user role if provided
    if (role) {
      if (!['admin', 'member', 'viewer'].includes(role)) {
        return c.json({ error: 'Invalid role. Must be: admin, member, or viewer' }, 400);
      }
      
      await kv.set(`user_${userId}_role`, role);
      updates.push(`role: ${role}`);
      console.log(`✅ Set user ${email} role to: ${role}`);
    }

    // Update subscription tier if provided
    if (tier) {
      if (!['free', 'pro'].includes(tier)) {
        return c.json({ error: 'Invalid tier. Must be: free or pro' }, 400);
      }

      // Set tier using both formats for compatibility
      await kv.set(`user:${userId}:tier`, tier);
      await kv.set(`user_${userId}_tier`, tier);
      
      if (tier === 'pro') {
        // Set subscription status
        await kv.set(`user:${userId}:subscription_status`, 'active');
        await kv.set(`user:${userId}:subscription_start`, new Date().toISOString());
        await kv.set(`user:${userId}:subscription_store`, 'admin_granted');
        
        // Also set in the main subscription object format
        const subscription = {
          tier: 'pro',
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: null,
          cancelAtPeriodEnd: false,
        };
        await kv.set(`user_${userId}_subscription`, subscription);
        
        updates.push(`tier: ${tier} (active)`);
        console.log(`✅ Set user ${email} to Pro tier`);
      } else {
        updates.push(`tier: ${tier}`);
        console.log(`✅ Set user ${email} to Free tier`);
      }
    }

    return c.json({ 
      success: true,
      message: `Updated user ${email}`,
      userId,
      updates,
      user: {
        id: userId,
        email: user.email,
        name: user.user_metadata?.name,
      }
    });
  } catch (error) {
    console.error('Error in admin set-user-access:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Admin endpoint to get user info by email
app.get("/taskzm-database-function/admin/get-user/:email", async (c) => {
  try {
    const { userId: adminUserId, error: authError } = await verifyAdmin(c.req.raw);
    if (authError || !adminUserId) {
      return c.json({ error: authError || 'Unauthorized' }, 401);
    }

    const email = c.req.param('email');
    
    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Get Supabase client
    const supabase = getSupabaseClient();
    
    // Find user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return c.json({ error: 'Failed to find user' }, 500);
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return c.json({ error: `User with email ${email} not found` }, 404);
    }

    const userId = user.id;

    // Get user data from KV store
    const role = await kv.get(`user_${userId}_role`);
    const tier = await kv.get(`user:${userId}:tier`) || await kv.get(`user_${userId}_tier`) || 'free';
    const subscriptionStatus = await kv.get(`user:${userId}:subscription_status`);
    const subscription = await kv.get(`user_${userId}_subscription`);
    const workspaceId = await kv.get(`user_${userId}_workspace`);

    return c.json({
      user: {
        id: userId,
        email: user.email,
        name: user.user_metadata?.name,
        role: role || 'member',
        tier,
        subscriptionStatus,
        subscription,
        workspaceId,
        createdAt: user.created_at,
      }
    });
  } catch (error) {
    console.error('Error in admin get-user:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// TEAM/INVITATION ENDPOINTS
// ============================================================================

// Invite team member
app.post("/taskzm-database-function/team/:workspaceId/invite", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const { email, name, role, teamId, avatar } = await c.req.json();

    if (!email || !name) {
      return c.json({ error: 'Email and name are required' }, 400);
    }

    const access = await assertWorkspaceMemberOrOwner(workspaceId, userId);
    if (!access.ok) {
      return c.json({ error: access.error }, access.status);
    }

    if (teamId) {
      const teamData = await kv.get(`team_${teamId}`);
      if (!teamData) {
        return c.json({ error: 'Team not found' }, 404);
      }
      const team = typeof teamData === 'string' ? JSON.parse(teamData) : teamData;
      if (team.workspaceId !== workspaceId) {
        return c.json({ error: 'Team does not belong to this workspace' }, 400);
      }
    }

    const supabase = getSupabaseClient();
    const existingUser = await findUserByEmail(supabase, email);
    if (existingUser) {
      const members = await getWorkspaceMembers(workspaceId);
      if (members.includes(existingUser.id)) {
        if (teamId) {
          const directAdd = await addExistingUserToTeamDirect({
            workspaceId,
            teamId,
            existingUser,
            name,
            role: role || 'member',
            avatar,
          });
          if ('error' in directAdd) {
            return c.json({ error: directAdd.error }, directAdd.status);
          }
          return c.json({
            success: true,
            message: 'Team member added',
            member: directAdd.member,
          });
        }
        return c.json({ error: 'User is already a member of this workspace' }, 400);
      }

      const directAdd = await addExistingUserToWorkspaceDirect({
        workspaceId,
        existingUser,
        name,
        role: role || 'member',
        avatar,
        teamId,
      });
      if ('error' in directAdd) {
        return c.json({ error: directAdd.error }, directAdd.status);
      }
      return c.json({
        success: true,
        message: 'Team member added',
        member: directAdd.member,
      });
    }

    const inviteResult = await sendWorkspaceInvitation({
      workspaceId,
      email,
      name,
      role: role || 'member',
      invitedBy: userId,
      teamId,
      avatar,
    });

    return c.json({
      invitation: inviteResult.invitation,
      inviteLink: inviteResult.inviteLink,
      alreadyPending: inviteResult.alreadyPending,
    });
  } catch (error) {
    console.log('Error sending invitation:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get team members
app.get("/taskzm-database-function/team/:workspaceId/members", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');

    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify workspace membership
    const members = await getWorkspaceMembers(workspaceId);
    
    if (!members.includes(userId)) {
      return c.json({ error: 'Unauthorized: Not a workspace member' }, 403);
    }

    // Get all member IDs
    const memberIds = members;
    const supabase = getSupabaseClient();
    
    // Fetch user details for each member
    const teamMembers = [];
    for (const memberId of memberIds) {
      try {
        const { data: user, error: userError } = await supabase.auth.admin.getUserById(memberId);
        if (!userError && user?.user) {
          // Get member role (default to 'member' if not set)
          let memberRole = await kv.get(`workspace_${workspaceId}_member_${memberId}_role`);
          if (!memberRole) {
            // If no role set, owner is admin, others are member
            const owner = await kv.get(`workspace_${workspaceId}_owner`);
            memberRole = memberId === owner ? 'admin' : 'member';
            // Save default role
            await kv.set(`workspace_${workspaceId}_member_${memberId}_role`, memberRole);
          }
          
          teamMembers.push({
            id: user.user.id,
            email: user.user.email || '',
            name: user.user.user_metadata?.name || user.user.email?.split('@')[0] || 'Unknown',
            role: memberRole,
            avatar: user.user.user_metadata?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.user.email || user.user.id}`,
            inviteStatus: 'accepted', // Existing members are accepted
          });
        } else if (userError) {
          console.log(`Error fetching user ${memberId}:`, userError);
        }
      } catch (err) {
        console.log(`Error fetching user ${memberId}:`, err);
      }
    }

    // Get pending invitations
    const invitationTokensStr = await kv.get(`workspace_${workspaceId}_invitations`);
    if (invitationTokensStr) {
      try {
        const tokens = JSON.parse(invitationTokensStr);
        for (const token of tokens) {
          const invitationData = await kv.get(`invitation_${token}`);
          if (invitationData) {
            const invitation = JSON.parse(invitationData);
            if (invitation.status === 'pending' && !invitation.teamId) {
              // Check if invitation is expired
              if (new Date(invitation.expiresAt) > new Date()) {
                teamMembers.push({
                  id: `pending_${token}`,
                  email: invitation.email,
                  name: invitation.name,
                  role: invitation.role,
                  inviteStatus: 'pending',
                  invitedAt: invitation.createdAt,
                  expiresAt: invitation.expiresAt,
                  invitationToken: token,
                });
              }
            }
          }
        }
      } catch (e) {
        console.log('Error parsing invitations:', e);
      }
    }

    return c.json({ members: teamMembers });
  } catch (error) {
    console.log('Error fetching team members:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Remove team member
app.delete("/taskzm-database-function/team/:workspaceId/members/:memberId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const memberId = c.req.param('memberId');

    const adminAccess = await assertWorkspaceAdminOrOwner(workspaceId, userId);
    if (!adminAccess.ok) {
      return c.json({ error: adminAccess.error }, adminAccess.status);
    }

    // Can't remove yourself
    if (memberId === userId) {
      return c.json({ error: 'Cannot remove yourself from workspace' }, 400);
    }

    // Handle pending invitations (IDs starting with "pending_")
    if (memberId.startsWith('pending_')) {
      const token = memberId.replace('pending_', '');
      await cancelPendingInvitation(workspaceId, token);
      return c.json({ success: true });
    }

    // Remove from members list
    const members = await getWorkspaceMembers(workspaceId);
    if (members.includes(memberId)) {
      const updatedMembers = members.filter((id: string) => id !== memberId);
      await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(updatedMembers));
      
      // Also remove role data
      await kv.del(`workspace_${workspaceId}_member_${memberId}_role`);
    }

    return c.json({ success: true });
  } catch (error) {
    console.log('Error removing team member:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Update team member role
app.put("/taskzm-database-function/team/:workspaceId/members/:memberId/role", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const memberId = c.req.param('memberId');
    const { role } = await c.req.json();

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    const adminAccess = await assertWorkspaceAdminOrOwner(workspaceId, userId);
    if (!adminAccess.ok) {
      return c.json({ error: adminAccess.error }, adminAccess.status);
    }

    // Pending invitations: update role on the invitation record
    if (memberId.startsWith('pending_')) {
      const token = memberId.replace('pending_', '');
      const invitationData = await kv.get(`invitation_${token}`);
      if (!invitationData) {
        return c.json({ error: 'Invitation not found' }, 404);
      }
      const invitation = JSON.parse(invitationData);
      if (invitation.workspaceId !== workspaceId) {
        return c.json({ error: 'Invitation not found in workspace' }, 404);
      }
      invitation.role = role;
      await kv.set(`invitation_${token}`, JSON.stringify(invitation));
      return c.json({ success: true, role });
    }
    
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(memberId)) {
      return c.json({ error: 'Member not found in workspace' }, 404);
    }

    // Update role
    await kv.set(`workspace_${workspaceId}_member_${memberId}_role`, role);

    return c.json({ success: true, role });
  } catch (error) {
    console.log('Error updating team member role:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Validate invitation token
app.post("/taskzm-database-function/team/invitations/validate", async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token) {
      return c.json({ error: 'Token is required' }, 400);
    }

    const invitationData = await kv.get(`invitation_${token}`);
    if (!invitationData) {
      return c.json({ error: 'Invalid invitation token' }, 404);
    }

    const invitation = JSON.parse(invitationData);

    // Check if expired
    if (new Date(invitation.expiresAt) < new Date()) {
      return c.json({ error: 'Invitation has expired' }, 400);
    }

    // Check if already accepted
    if (invitation.status !== 'pending') {
      return c.json({ error: 'Invitation has already been processed' }, 400);
    }

    return c.json({
      valid: true,
      invitation: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        workspaceId: invitation.workspaceId,
      }
    });
  } catch (error) {
    console.log('Error validating invitation:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Accept invitation
app.post("/taskzm-database-function/team/invitations/accept", async (c) => {
  try {
    const { token, password } = await c.req.json();

    if (!token) {
      return c.json({ error: 'Token is required' }, 400);
    }

    const invitationData = await kv.get(`invitation_${token}`);
    if (!invitationData) {
      return c.json({ error: 'Invalid invitation token' }, 404);
    }

    const invitation = JSON.parse(invitationData);

    // Check if expired
    if (new Date(invitation.expiresAt) < new Date()) {
      return c.json({ error: 'Invitation has expired' }, 400);
    }

    // Check if already accepted
    if (invitation.status !== 'pending') {
      return c.json({ error: 'Invitation has already been processed' }, 400);
    }

    const supabase = getSupabaseClient();

    // Check if user already exists
    const { data: users } = await supabase.auth.admin.listUsers();
    const existingUser = users?.users.find(u => u.email?.toLowerCase() === invitation.email.toLowerCase());

    let userId: string;

    if (existingUser) {
      // User exists, just add to workspace
      userId = existingUser.id;
      
      // Ensure existing user has their own workspace (in case they don't)
      let userWorkspace = await kv.get(`user_${userId}_workspace`);
      if (!userWorkspace) {
        console.log(`⚠️ Existing user ${userId} has no workspace, creating one during invitation acceptance`);
        userWorkspace = `workspace_${userId}_${Date.now()}`;
        const userMembersArray = [userId];
        await kv.set(`user_${userId}_workspace`, userWorkspace);
        await kv.set(`workspace_${userWorkspace}_owner`, userId);
        await kv.set(`workspace_${userWorkspace}_members`, JSON.stringify(userMembersArray));
        await kv.set(`workspace_${userWorkspace}_name`, `${invitation.name}'s Workspace`);
        console.log(`✅ Created workspace ${userWorkspace} for existing user ${userId}`);
      }
    } else {
      // Create new user account
      if (!password) {
        return c.json({ error: 'Password is required for new accounts' }, 400);
      }

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: invitation.email,
        password,
        user_metadata: {
          name: invitation.name,
        },
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        return c.json({ error: createError?.message || 'Failed to create user account' }, 400);
      }

      userId = newUser.user.id;

      // Create workspace for new user
      const userWorkspaceId = `workspace_${userId}_${Date.now()}`;
      const userMembersArray = [userId];
      await kv.set(`user_${userId}_workspace`, userWorkspaceId);
      await kv.set(`workspace_${userWorkspaceId}_owner`, userId);
      await kv.set(`workspace_${userWorkspaceId}_members`, JSON.stringify(userMembersArray));
      await kv.set(`workspace_${userWorkspaceId}_name`, `${invitation.name}'s Workspace`);
    }

    // Add user to invited workspace
    const workspaceId = invitation.workspaceId;
    let members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      members.push(userId);
      await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(members));
    }

    // Set member role
    await kv.set(`workspace_${workspaceId}_member_${userId}_role`, invitation.role);

    // Add to specific team when invitation was team-scoped
    if (invitation.teamId) {
      const invitedTeamId = invitation.teamId;
      const teamMembersData = await kv.get(`team_${invitedTeamId}_members`);
      const teamMemberIds = teamMembersData ? JSON.parse(teamMembersData) : [];
      if (!teamMemberIds.includes(userId)) {
        teamMemberIds.push(userId);
        await kv.set(`team_${invitedTeamId}_members`, JSON.stringify(teamMemberIds));
      }

      const invitedTeamData = await kv.get(`team_${invitedTeamId}`);
      if (invitedTeamData) {
        const invitedTeam = typeof invitedTeamData === 'string' ? JSON.parse(invitedTeamData) : invitedTeamData;
        invitedTeam.memberCount = teamMemberIds.length;
        await kv.set(`team_${invitedTeamId}`, JSON.stringify(invitedTeam));
      }

      await kv.set(`workspace_${workspaceId}_member_${userId}`, JSON.stringify({
        role: invitation.role,
        teamId: invitedTeamId,
      }));
    }

    // Mark invitation as accepted
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date().toISOString();
    invitation.acceptedBy = userId;
    await kv.set(`invitation_${token}`, JSON.stringify(invitation));

    // Send notification to inviter (optional, don't fail if it fails)
    try {
      const { data: inviterUser } = await supabase.auth.admin.getUserById(invitation.invitedBy);
      if (inviterUser?.user?.email) {
        const workspaceName = await kv.get(`workspace_${workspaceId}_name`);
        await emailService.sendInvitationAcceptedNotification(
          inviterUser.user.email,
          invitation.name,
          workspaceName
        );
      }
    } catch (err) {
      // Silently fail - notification is optional
      console.log('Could not send acceptance notification:', err);
    }

    return c.json({
      success: true,
      userId,
      workspaceId,
      message: existingUser ? 'Added to workspace' : 'Account created and added to workspace',
    });
  } catch (error) {
    console.log('Error accepting invitation:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Resend invitation
app.post("/taskzm-database-function/team/:workspaceId/invitations/resend", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const { token } = await c.req.json();

    if (!token) {
      return c.json({ error: 'Invitation token is required' }, 400);
    }

    // Verify workspace membership
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Unauthorized: Not a workspace member' }, 403);
    }

    // Get existing invitation
    const invitationData = await kv.get(`invitation_${token}`);
    if (!invitationData) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    const invitation = JSON.parse(invitationData);
    
    if (invitation.workspaceId !== workspaceId) {
      return c.json({ error: 'Invalid invitation for this workspace' }, 400);
    }

    // Generate new expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update invitation
    invitation.expiresAt = expiresAt.toISOString();
    invitation.createdAt = new Date().toISOString();
    
    await kv.set(`invitation_${token}`, JSON.stringify(invitation));

    // Get inviter's name for email
    const supabase = getSupabaseClient();
    let inviterName = 'Someone';
    try {
      const { data: inviterUser } = await supabase.auth.admin.getUserById(invitation.invitedBy);
      if (inviterUser?.user) {
        inviterName = inviterUser.user.user_metadata?.name || inviterUser.user.email?.split('@')[0] || 'Someone';
      }
    } catch (err) {
      console.log('Could not fetch inviter name:', err);
    }

    // Get workspace name if available
    const workspaceName = await kv.get(`workspace_${workspaceId}_name`);

    // Send invitation email
    const inviteLink = `https://taskzm.com/invite?token=${token}`;
    const emailResult = await emailService.sendInvitationEmail({
      to: invitation.email.toLowerCase(),
      inviterName,
      inviteeName: invitation.name,
      workspaceName,
      role: invitation.role,
      inviteLink,
      expiresInDays: 7,
    });

    if (emailResult.success) {
      console.log(`✅ Invitation email resent to ${invitation.email} for workspace ${workspaceId}`);
    } else {
      console.warn(`⚠️ Failed to resend invitation email to ${invitation.email}:`, emailResult.error);
      // Don't fail the resend if email fails - still return success
    }

    return c.json({
      success: true,
      invitation: {
        ...invitation,
        token,
      },
      inviteLink: `https://taskzm.com/invite?token=${token}`,
    });
  } catch (error) {
    console.log('Error resending invitation:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Decline invitation
app.post("/taskzm-database-function/team/:workspaceId/invitations/decline", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const { token } = await c.req.json();

    if (!token) {
      return c.json({ error: 'Invitation token is required' }, 400);
    }

    // Verify workspace membership
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Unauthorized: Not a workspace member' }, 403);
    }

    // Get existing invitation
    const invitationData = await kv.get(`invitation_${token}`);
    if (!invitationData) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    const invitation = JSON.parse(invitationData);
    
    if (invitation.workspaceId !== workspaceId) {
      return c.json({ error: 'Invalid invitation for this workspace' }, 400);
    }

    // Mark as declined
    invitation.status = 'declined';
    invitation.declinedAt = new Date().toISOString();
    await kv.set(`invitation_${token}`, JSON.stringify(invitation));

    // Remove from workspace invitations list
    const invitationsStr = await kv.get(`workspace_${workspaceId}_invitations`);
    if (invitationsStr) {
      try {
        const invitations = JSON.parse(invitationsStr);
        const updated = invitations.filter((t: string) => t !== token);
        await kv.set(`workspace_${workspaceId}_invitations`, JSON.stringify(updated));
      } catch (e) {
        console.log('Error updating invitations list:', e);
      }
    }

    return c.json({ success: true, message: 'Invitation declined' });
  } catch (error) {
    console.log('Error declining invitation:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// MULTI-TEAM ENDPOINTS
// ============================================================================

// Create a new team
app.post("/taskzm-database-function/teams/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const { name, description } = await c.req.json();

    if (!name || !name.trim()) {
      return c.json({ error: 'Team name is required' }, 400);
    }

    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify user is workspace member (admin check done on frontend)
    let members = await kv.get(`workspace_${workspaceId}_members`);
    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (e) {
        members = [workspaceOwner];
      }
    }
    if (!members || !Array.isArray(members)) {
      members = [workspaceOwner];
    }
    
    if (!members.includes(userId) && workspaceOwner !== userId) {
      return c.json({ error: 'Unauthorized: Not a workspace member' }, 403);
    }

    // Generate team ID
    const teamId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Create team object
    const team = {
      id: teamId,
      name: name.trim(),
      description: description?.trim() || '',
      workspaceId,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      maxMembers: 8,
      memberCount: 0,
    };

    // Store team
    await kv.set(`team_${teamId}`, JSON.stringify(team));

    // Add team to workspace's teams list
    const existingTeams = await kv.get(`workspace_${workspaceId}_teams`);
    const teams = existingTeams ? JSON.parse(existingTeams) : [];
    if (!teams.includes(teamId)) {
      teams.push(teamId);
      await kv.set(`workspace_${workspaceId}_teams`, JSON.stringify(teams));
    }

    // Initialize empty members list for team
    await kv.set(`team_${teamId}_members`, JSON.stringify([]));

    return c.json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Update team
app.put("/taskzm-database-function/teams/:teamId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    const { name, description } = await c.req.json();

    if (!name || !name.trim()) {
      return c.json({ error: 'Team name is required' }, 400);
    }

    // Get team info
    const teamData = await kv.get(`team_${teamId}`);
    if (!teamData) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const team = typeof teamData === 'string' ? JSON.parse(teamData) : teamData;

    // Verify user has access to workspace
    const workspaceId = team.workspaceId;
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    let members = await kv.get(`workspace_${workspaceId}_members`);
    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (e) {
        members = [workspaceOwner];
      }
    }
    if (!members || !Array.isArray(members)) {
      members = [workspaceOwner];
    }
    
    if (!members.includes(userId) && workspaceOwner !== userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Update team
    team.name = name.trim();
    team.description = description?.trim() || '';
    team.updatedAt = new Date().toISOString();

    // Save updated team
    await kv.set(`team_${teamId}`, JSON.stringify(team));

    return c.json(team);
  } catch (error) {
    console.error('Error updating team:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Delete team
app.delete("/taskzm-database-function/teams/:teamId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');

    // Get team info
    const teamData = await kv.get(`team_${teamId}`);
    if (!teamData) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const team = typeof teamData === 'string' ? JSON.parse(teamData) : teamData;

    // Verify user has access to workspace (admin check)
    const workspaceId = team.workspaceId;
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    let members = await kv.get(`workspace_${workspaceId}_members`);
    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (e) {
        members = [workspaceOwner];
      }
    }
    
    // Only workspace owner or team creator can delete
    if (workspaceOwner !== userId && team.createdBy !== userId) {
      return c.json({ error: 'Unauthorized: Only team creator or workspace owner can delete teams' }, 403);
    }

    // Delete team data
    await kv.del(`team_${teamId}`);
    await kv.del(`team_${teamId}_members`);

    // Remove from workspace teams list
    const teamsData = await kv.get(`workspace_${workspaceId}_teams`);
    if (teamsData) {
      const teamIds = JSON.parse(teamsData);
      const updatedTeamIds = teamIds.filter((id: string) => id !== teamId);
      await kv.set(`workspace_${workspaceId}_teams`, JSON.stringify(updatedTeamIds));
    }

    return c.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get all teams for a workspace
app.get("/taskzm-database-function/teams/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');

    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ teams: [] });
    }

    // Verify user is workspace member
    let members = await kv.get(`workspace_${workspaceId}_members`);
    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (e) {
        members = [workspaceOwner];
      }
    }
    if (!members || !Array.isArray(members)) {
      members = [workspaceOwner];
    }
    
    if (!members.includes(userId) && workspaceOwner !== userId) {
      return c.json({ teams: [] });
    }

    // Get teams for workspace
    const teamsData = await kv.get(`workspace_${workspaceId}_teams`);
    const teamIds = teamsData ? JSON.parse(teamsData) : [];

    // Fetch all team objects
    const teams = [];
    for (const teamId of teamIds) {
      const teamData = await kv.get(`team_${teamId}`);
      if (teamData) {
        const team = typeof teamData === 'string' ? JSON.parse(teamData) : teamData;
        
        // Get current member count
        const membersData = await kv.get(`team_${teamId}_members`);
        const membersList = membersData ? JSON.parse(membersData) : [];
        team.memberCount = membersList.length;
        
        teams.push(team);
      }
    }

    return c.json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return c.json({ teams: [] });
  }
});

// Get members for a specific team
app.get("/taskzm-database-function/teams/:teamId/members", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');

    // Get team info
    const teamData = await kv.get(`team_${teamId}`);
    if (!teamData) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const team = typeof teamData === 'string' ? JSON.parse(teamData) : teamData;

    // Verify user has access to workspace
    const workspaceId = team.workspaceId;
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    let members = await kv.get(`workspace_${workspaceId}_members`);
    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (e) {
        members = [workspaceOwner];
      }
    }
    if (!members || !Array.isArray(members)) {
      members = [workspaceOwner];
    }
    
    if (!members.includes(userId) && workspaceOwner !== userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Get team members
    const teamMembersData = await kv.get(`team_${teamId}_members`);
    const teamMemberIds = teamMembersData ? JSON.parse(teamMembersData) : [];

    // Fetch member details
    const supabase = getSupabaseClient();
    const teamMembers = [];

    for (const memberId of teamMemberIds) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(memberId);
        if (userData?.user) {
          const user = userData.user;
          let memberRole = await kv.get(`workspace_${workspaceId}_member_${memberId}_role`);
          if (!memberRole) {
            const memberData = await kv.get(`workspace_${workspaceId}_member_${memberId}`);
            const memberInfo = memberData ? (typeof memberData === 'string' ? JSON.parse(memberData) : memberData) : {};
            memberRole = memberInfo.role || 'member';
          }

          teamMembers.push({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'Unknown',
            avatar: user.user_metadata?.avatar,
            role: memberRole,
            inviteStatus: 'accepted',
            teamId: teamId,
          });
        }
      } catch (err) {
        console.log('Error fetching team member:', err);
      }
    }

    // Include pending email invitations scoped to this team
    const invitationTokensStr = await kv.get(`workspace_${workspaceId}_invitations`);
    if (invitationTokensStr) {
      try {
        const tokens = JSON.parse(invitationTokensStr);
        for (const token of tokens) {
          const invitationData = await kv.get(`invitation_${token}`);
          if (!invitationData) continue;
          const invitation = JSON.parse(invitationData);
          if (
            invitation.status === 'pending' &&
            invitation.teamId === teamId &&
            new Date(invitation.expiresAt) > new Date()
          ) {
            teamMembers.push({
              id: `pending_${token}`,
              email: invitation.email,
              name: invitation.name,
              role: invitation.role,
              avatar: invitation.avatar,
              inviteStatus: 'pending',
              invitedAt: invitation.createdAt,
              expiresAt: invitation.expiresAt,
              invitationToken: token,
              teamId,
            });
          }
        }
      } catch (e) {
        console.log('Error parsing team invitations:', e);
      }
    }

    return c.json(teamMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Invite member to specific team
app.post("/taskzm-database-function/teams/:teamId/invite", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    const { email, name, role, avatar } = await c.req.json();

    if (!email || !name) {
      return c.json({ error: 'Email and name are required' }, 400);
    }

    // Get team info
    const teamData = await kv.get(`team_${teamId}`);
    if (!teamData) {
      return c.json({ error: 'Team not found' }, 404);
    }

    const team = typeof teamData === 'string' ? JSON.parse(teamData) : teamData;
    const workspaceId = team.workspaceId;

    const access = await assertWorkspaceMemberOrOwner(workspaceId, userId);
    if (!access.ok) {
      return c.json({ error: access.error }, access.status);
    }

    // Check team member limit
    const teamMembersData = await kv.get(`team_${teamId}_members`);
    const teamMemberIds = teamMembersData ? JSON.parse(teamMembersData) : [];
    if (teamMemberIds.length >= team.maxMembers) {
      return c.json({ error: `Maximum of ${team.maxMembers} members per team` }, 400);
    }

    const supabase = getSupabaseClient();
    const existingMember = await findUserByEmail(supabase, email);
    
    if (existingMember && teamMemberIds.includes(existingMember.id)) {
      return c.json({ error: 'User is already a team member' }, 400);
    }

    // If user exists, add them directly to workspace (if needed) and team
    if (existingMember) {
      const directAdd = await addExistingUserToTeamDirect({
        workspaceId,
        teamId,
        existingUser: existingMember,
        name,
        role: role || 'member',
        avatar,
      });
      if ('error' in directAdd) {
        return c.json({ error: directAdd.error }, directAdd.status);
      }
      return c.json({
        success: true,
        message: 'Team member added',
        member: directAdd.member,
      });
    }

    const inviteResult = await sendWorkspaceInvitation({
      workspaceId,
      email,
      name,
      role: role || 'member',
      invitedBy: userId,
      teamId,
      avatar,
      emailSubjectName: team.name,
    });

    return c.json({
      invitation: inviteResult.invitation,
      inviteLink: inviteResult.inviteLink,
      alreadyPending: inviteResult.alreadyPending,
    });
  } catch (error) {
    console.error('Error inviting team member:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Remove member from a specific sub-team (does not remove from workspace)
app.delete("/taskzm-database-function/teams/:teamId/members/:memberId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    const memberId = c.req.param('memberId');

    const teamData = await kv.get(`team_${teamId}`);
    if (!teamData) {
      return c.json({ error: 'Team not found' }, 404);
    }
    const team = typeof teamData === 'string' ? JSON.parse(teamData) : teamData;
    const workspaceId = team.workspaceId;

    const adminAccess = await assertWorkspaceAdminOrOwner(workspaceId, userId);
    if (!adminAccess.ok) {
      return c.json({ error: adminAccess.error }, adminAccess.status);
    }

    if (memberId === userId) {
      return c.json({ error: 'Cannot remove yourself from the team' }, 400);
    }

    if (memberId.startsWith('pending_')) {
      const token = memberId.replace('pending_', '');
      const invitationData = await kv.get(`invitation_${token}`);
      if (invitationData) {
        const invitation = JSON.parse(invitationData);
        if (invitation.teamId !== teamId) {
          return c.json({ error: 'Invitation is not for this team' }, 400);
        }
      }
      await cancelPendingInvitation(workspaceId, token);
      return c.json({ success: true });
    }

    const teamMembersData = await kv.get(`team_${teamId}_members`);
    const teamMemberIds: string[] = teamMembersData ? JSON.parse(teamMembersData) : [];
    if (!teamMemberIds.includes(memberId)) {
      return c.json({ error: 'Member not found in team' }, 404);
    }

    const updatedMemberIds = teamMemberIds.filter((id: string) => id !== memberId);
    await kv.set(`team_${teamId}_members`, JSON.stringify(updatedMemberIds));
    team.memberCount = updatedMemberIds.length;
    await kv.set(`team_${teamId}`, JSON.stringify(team));

    const memberMeta = await kv.get(`workspace_${workspaceId}_member_${memberId}`);
    if (memberMeta) {
      try {
        const parsed = typeof memberMeta === 'string' ? JSON.parse(memberMeta) : memberMeta;
        if (parsed.teamId === teamId) {
          delete parsed.teamId;
          await kv.set(`workspace_${workspaceId}_member_${memberId}`, JSON.stringify(parsed));
        }
      } catch (e) {
        console.log('Error updating member team association:', e);
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error removing team member from team:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Update member role for a sub-team member (workspace role; applies across teams)
app.put("/taskzm-database-function/teams/:teamId/members/:memberId/role", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const teamId = c.req.param('teamId');
    const memberId = c.req.param('memberId');
    const { role } = await c.req.json();

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    const teamData = await kv.get(`team_${teamId}`);
    if (!teamData) {
      return c.json({ error: 'Team not found' }, 404);
    }
    const team = typeof teamData === 'string' ? JSON.parse(teamData) : teamData;
    const workspaceId = team.workspaceId;

    const adminAccess = await assertWorkspaceAdminOrOwner(workspaceId, userId);
    if (!adminAccess.ok) {
      return c.json({ error: adminAccess.error }, adminAccess.status);
    }

    if (memberId.startsWith('pending_')) {
      const token = memberId.replace('pending_', '');
      const invitationData = await kv.get(`invitation_${token}`);
      if (!invitationData) {
        return c.json({ error: 'Invitation not found' }, 404);
      }
      const invitation = JSON.parse(invitationData);
      if (invitation.teamId !== teamId) {
        return c.json({ error: 'Invitation is not for this team' }, 400);
      }
      invitation.role = role;
      await kv.set(`invitation_${token}`, JSON.stringify(invitation));
      return c.json({ success: true, role });
    }

    const teamMembersData = await kv.get(`team_${teamId}_members`);
    const teamMemberIds: string[] = teamMembersData ? JSON.parse(teamMembersData) : [];
    if (!teamMemberIds.includes(memberId)) {
      return c.json({ error: 'Member not found in team' }, 404);
    }

    await kv.set(`workspace_${workspaceId}_member_${memberId}_role`, role);
    const memberMeta = await kv.get(`workspace_${workspaceId}_member_${memberId}`);
    if (memberMeta) {
      try {
        const parsed = typeof memberMeta === 'string' ? JSON.parse(memberMeta) : memberMeta;
        parsed.role = role;
        await kv.set(`workspace_${workspaceId}_member_${memberId}`, JSON.stringify(parsed));
      } catch (e) {
        console.log('Error updating member role metadata:', e);
      }
    }

    return c.json({ success: true, role });
  } catch (error) {
    console.error('Error updating team member role:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// USER AWARDS ENDPOINTS
// ============================================================================
// IMPORTANT: These routes must be defined BEFORE the catch-all route

// Get all awards handler
const getUserAwardsHandler = async (c: any) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const supabase = getSupabaseClient();
    
    // Attempt to query the table
    let awards = null;
    let queryError = null;
    
    try {
      const result = await supabase
        .from('user_awards')
        .select('award_id, earned_at, progress')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });
      
      awards = result.data;
      queryError = result.error;
    } catch (queryException) {
      // Catch any exceptions thrown during the query
      queryError = queryException as any;
      console.error('Exception during user_awards query:', queryException);
    }

    if (queryError) {
      console.error('Error fetching user awards:', queryError);
      
      // Handle table not found errors - return empty array instead of 500
      const errorCode = (queryError as any)?.code || (queryError as any)?.error_code || '';
      const errorMessage = (queryError as any)?.message || String(queryError) || '';
      
      // PGRST205 = table not found, 42P01 = relation does not exist, PGRST116 = schema not found
      const isTableNotFound = 
        errorCode === '42P01' || 
        errorCode === 'PGRST116' || 
        errorCode === 'PGRST205' ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('Could not find the table') ||
        errorMessage.includes('relation') && errorMessage.includes('does not exist');
      
      if (isTableNotFound) {
        console.warn('user_awards table does not exist, returning empty array');
        return c.json({ awards: [] });
      }
      
      // For other errors, return 500 with error details
      return c.json({ 
        error: `Failed to fetch awards: ${errorMessage}`,
        code: errorCode 
      }, 500);
    }

    // Transform to match UserAward interface
    const userAwards = (awards || []).map(award => ({
      awardId: award.award_id,
      earnedAt: award.earned_at,
      progress: award.progress,
    }));

    return c.json({ awards: userAwards });
  } catch (error) {
    console.error('Error in get user awards:', error);
    const errorMessage = getErrorMessage(error);
    const errorCode = (error as any)?.code || '';
    
    // If it's a table not found error, return empty array
    // PGRST205 = table not found, 42P01 = relation does not exist, PGRST116 = schema not found
    if (errorCode === '42P01' || 
        errorCode === 'PGRST116' ||
        errorCode === 'PGRST205' ||
        errorMessage.includes('does not exist') || 
        errorMessage.includes('Could not find the table') ||
        errorMessage.includes('relation')) {
      console.warn('user_awards table does not exist, returning empty array');
      return c.json({ awards: [] });
    }
    
    return c.json({ error: errorMessage }, 500);
  }
};

// Save multiple awards handler
const saveUserAwardsHandler = async (c: any) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { awards } = await c.req.json();
    if (!Array.isArray(awards)) {
      return c.json({ error: 'Awards must be an array' }, 400);
    }

    const supabase = getSupabaseClient();
    let saved = 0;
    const errors: string[] = [];

    // Upsert each award
    for (const award of awards) {
      const { error } = await supabase
        .from('user_awards')
        .upsert({
          user_id: userId,
          award_id: award.awardId,
          earned_at: award.earnedAt || new Date().toISOString(),
          progress: award.progress || null,
        }, {
          onConflict: 'user_id,award_id',
        });

      if (!error) {
        saved++;
      } else {
        const errorCode = error.code || '';
        const errorMessage = error.message || '';
        const errorMsg = (errorCode === '42P01' || 
                         errorCode === 'PGRST116' || 
                         errorCode === 'PGRST205' ||
                         errorMessage.includes('does not exist') ||
                         errorMessage.includes('Could not find the table'))
          ? 'user_awards table does not exist'
          : errorMessage;
        console.error(`Error saving award ${award.awardId}:`, error);
        errors.push(`Award ${award.awardId}: ${errorMsg}`);
      }
    }

    // If table doesn't exist, return error
    if (errors.length > 0 && errors.some(e => e.includes('does not exist'))) {
      return c.json({ 
        error: 'user_awards table does not exist. Please create the table in Supabase.',
        saved: 0 
      }, 500);
    }

    return c.json({ success: true, saved, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error('Error in save user awards:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
};

// Save a single award handler
const saveUserAwardHandler = async (c: any) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { award } = await c.req.json();
    if (!award || !award.awardId) {
      return c.json({ error: 'Award data is required' }, 400);
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('user_awards')
      .upsert({
        user_id: userId,
        award_id: award.awardId,
        earned_at: award.earnedAt || new Date().toISOString(),
        progress: award.progress || null,
      }, {
        onConflict: 'user_id,award_id',
      });

    if (error) {
      console.error('Error saving award:', error);
      // Check if table doesn't exist
      const errorCode = error.code || '';
      const errorMessage = error.message || '';
      if (errorCode === '42P01' || 
          errorCode === 'PGRST116' ||
          errorCode === 'PGRST205' ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('Could not find the table')) {
        return c.json({ 
          error: 'user_awards table does not exist. Please create the table in Supabase.',
          code: errorCode 
        }, 500);
      }
      return c.json({ error: `Failed to save award: ${errorMessage}`, code: errorCode }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error in save user award:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
};

// Register awards routes both with and without prefix for compatibility
// IMPORTANT: Register routes BEFORE the catch-all route
app.get("/taskzm-database-function/user/awards", getUserAwardsHandler);
app.get("/user/awards", getUserAwardsHandler);
app.post("/taskzm-database-function/user/awards", saveUserAwardsHandler);
app.post("/user/awards", saveUserAwardsHandler);
app.post("/taskzm-database-function/user/awards/single", saveUserAwardHandler);
app.post("/user/awards/single", saveUserAwardHandler);

// ============================================================================
// CATCH-ALL ROUTE (must be last)
// ============================================================================
// Catch-all route for debugging 404 errors
// IMPORTANT: This must be defined AFTER all other routes
app.all('*', async (c) => {
  const path = new URL(c.req.url).pathname;
  console.log('Unmatched route requested:', {
    method: c.req.method,
    path,
    url: c.req.url,
  });
  return c.json({ 
    error: 'Route not found',
    method: c.req.method,
    path,
  }, 404);
});

// Normalize request path so Hono routes match.
// Supabase can pass either:
// - /functions/v1/taskzm-database-function/... → use /taskzm-database-function/...
// - /calendar/... (path after function name only) → use /taskzm-database-function/calendar/...
const FUNCTION_NAME = "taskzm-database-function";
Deno.serve(async (req) => {
  const url = new URL(req.url);
  let pathname = url.pathname;
  if (pathname.startsWith("/functions/v1/")) {
    pathname = pathname.replace(/^\/functions\/v1\/?/, "/");
  } else if (!pathname.startsWith(`/${FUNCTION_NAME}`) && (pathname.startsWith("/calendar/") || pathname === "/calendar" || pathname === "")) {
    pathname = `/${FUNCTION_NAME}` + (pathname.startsWith("/") ? pathname : "/" + pathname);
  }
  const newUrl = new URL(req.url);
  newUrl.pathname = pathname;
  const normalizedRequest = new Request(newUrl.toString(), {
    method: req.method,
    headers: req.headers,
    body: req.body,
    duplex: "half",
  });
  return app.fetch(normalizedRequest);
});
