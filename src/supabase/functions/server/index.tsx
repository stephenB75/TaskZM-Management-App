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
  let members = await kv.get(`workspace_${workspaceId}_members`);
  
  // Handle both array and JSON string formats
  if (typeof members === 'string') {
    try {
      members = JSON.parse(members);
    } catch (e) {
      console.log('Error parsing members, initializing with owner:', e);
      // If parsing fails, get owner and initialize
      const owner = await kv.get(`workspace_${workspaceId}_owner`);
      if (owner) {
        members = [owner];
        await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(members));
      } else {
        members = [];
      }
    }
  }
  
  // Ensure members is an array
  if (!members || !Array.isArray(members)) {
    const owner = await kv.get(`workspace_${workspaceId}_owner`);
    if (owner) {
      members = [owner];
      await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(members));
    } else {
      members = [];
    }
  }
  
  return members;
}

// Health check endpoint
app.get("/make-server-65e6e67f/health", (c) => {
  return c.json({ status: "ok" });
});

// User signup endpoint
app.post("/make-server-65e6e67f/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, isDemo } = body;

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

// Get all tasks for a workspace
app.get("/make-server-65e6e67f/tasks/:workspaceId", async (c) => {
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

    // Get all tasks for this workspace
    const tasksData = await kv.getByPrefix(`workspace_${workspaceId}_task_`);
    const tasks = tasksData.map(item => item.value);

    return c.json({ tasks });
  } catch (error) {
    console.log('Error fetching tasks:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Create or update task
app.post("/make-server-65e6e67f/tasks/:workspaceId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const task = await c.req.json();

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

    // Save task
    await kv.set(`workspace_${workspaceId}_task_${task.id}`, task);

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
app.delete("/make-server-65e6e67f/tasks/:workspaceId/:taskId", async (c) => {
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

    // Verify user has access to this workspace
    const members = await getWorkspaceMembers(workspaceId);
    if (!members.includes(userId)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Delete task
    await kv.del(`workspace_${workspaceId}_task_${taskId}`);

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
app.get("/make-server-65e6e67f/workspace/:workspaceId", async (c) => {
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
app.get("/make-server-65e6e67f/user/workspaces", async (c) => {
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
app.post("/make-server-65e6e67f/user/workspaces", async (c) => {
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
app.get("/make-server-65e6e67f/activities/:workspaceId", async (c) => {
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
app.post("/make-server-65e6e67f/time-tracking/:workspaceId", async (c) => {
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
app.get("/make-server-65e6e67f/time-tracking/:workspaceId", async (c) => {
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
app.get("/make-server-65e6e67f/projects/:workspaceId", async (c) => {
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
app.post("/make-server-65e6e67f/projects/:workspaceId", async (c) => {
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
app.delete("/make-server-65e6e67f/projects/:workspaceId/:projectId", async (c) => {
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
app.get("/make-server-65e6e67f/folders/:workspaceId", async (c) => {
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
app.post("/make-server-65e6e67f/folders/:workspaceId", async (c) => {
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
app.put("/make-server-65e6e67f/folders/:workspaceId/:folderId", async (c) => {
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
app.delete("/make-server-65e6e67f/folders/:workspaceId/:folderId", async (c) => {
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
app.get("/make-server-65e6e67f/settings/:workspaceId", async (c) => {
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
app.post("/make-server-65e6e67f/settings/:workspaceId", async (c) => {
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
app.get("/make-server-65e6e67f/subscription", async (c) => {
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
app.post("/make-server-65e6e67f/subscription", async (c) => {
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
// DEMO USER CLEANUP ENDPOINT
// ========================================

// Delete demo user and all associated data
app.delete("/make-server-65e6e67f/cleanup-demo-user", async (c) => {
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
app.get("/make-server-65e6e67f/admin/demo-stats", async (c) => {
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
app.post("/make-server-65e6e67f/admin/cleanup-all-demos", async (c) => {
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
app.post("/make-server-65e6e67f/demo/update-login-time", async (c) => {
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
app.post("/make-server-65e6e67f/demo/update-activity", async (c) => {
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
// This endpoint checks for demo users with no activity > 1 hour and cleans them up
app.post("/make-server-65e6e67f/demo/cleanup-inactive", async (c) => {
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
    
    const { maxInactiveMinutes = 15 } = body;
    
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
app.get("/make-server-65e6e67f/calendar/google/auth", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    let redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');

    // Clean and validate redirect URI
    if (redirectUri) {
      // Remove any query parameters or fragments that might have been accidentally included
      redirectUri = redirectUri.trim().split('?')[0].split('#')[0];
      
      // Validate it's a proper HTTPS URL
      try {
        const url = new URL(redirectUri);
        if (url.protocol !== 'https:') {
          console.error('Invalid redirect URI protocol:', redirectUri);
          return c.json({ 
            error: 'GOOGLE_REDIRECT_URI must use https:// protocol',
          }, 500);
        }
      } catch (e) {
        console.error('Invalid redirect URI format:', redirectUri);
        return c.json({ 
          error: 'GOOGLE_REDIRECT_URI is not a valid URL',
        }, 500);
      }
    }

    console.log('Google OAuth config check:', {
      hasClientId: !!clientId,
      hasRedirectUri: !!redirectUri,
      redirectUri,
      clientIdPrefix: clientId ? `${clientId.substring(0, 20)}...` : 'missing',
    });

    if (!clientId || !redirectUri) {
      console.log('Google OAuth not configured - missing env vars');
      return c.json({ 
        error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI environment variables.',
        details: {
          hasClientId: !!clientId,
          hasRedirectUri: !!redirectUri,
        }
      }, 500);
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', userId); // Pass userId in state

    console.log('Google OAuth URL generated successfully for user:', userId);
    return c.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.log('Error initiating Google OAuth:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Google Calendar OAuth callback
app.get("/make-server-65e6e67f/calendar/google/callback", async (c) => {
  try {
    const code = c.req.query('code');
    const userId = c.req.query('state');
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

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    let redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');

    // Clean redirect URI (remove any query parameters or fragments)
    if (redirectUri) {
      redirectUri = redirectUri.trim().split('?')[0].split('#')[0];
    }

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
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Google token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
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

    console.log('Google token exchange successful for user:', userId);

    // Store tokens
    const tokens: calendarSync.CalendarTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      provider: 'google',
    };

    await calendarSync.storeCalendarTokens(userId, 'google', tokens);
    console.log('Google Calendar tokens stored successfully for user:', userId);

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
        provider: 'google' 
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
    console.log('Error in Google OAuth callback:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Initiate Outlook Calendar OAuth flow
app.get("/make-server-65e6e67f/calendar/outlook/auth", async (c) => {
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
      'https://graph.microsoft.com/Calendars.ReadWrite',
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
app.get("/make-server-65e6e67f/calendar/outlook/callback", async (c) => {
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
        scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
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
app.get("/make-server-65e6e67f/calendar/status", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      console.log('Calendar status check - unauthorized:', { authError, userId });
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const googleTokens = await calendarSync.getCalendarTokens(userId, 'google');
    const outlookTokens = await calendarSync.getCalendarTokens(userId, 'outlook');
    const appleTokens = await calendarSync.getCalendarTokens(userId, 'apple');

    const status = {
      google: !!googleTokens,
      outlook: !!outlookTokens,
      apple: !!appleTokens,
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
app.post("/make-server-65e6e67f/calendar/apple/setup", appleCalendarSetupHandler);
app.post("/calendar/apple/setup", appleCalendarSetupHandler);

// Test/Verify Apple Calendar connection - SHORTCUT METHOD
// Validates credentials by testing authentication only (no complex discovery)
app.get("/make-server-65e6e67f/calendar/apple/test", async (c) => {
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
app.delete("/make-server-65e6e67f/calendar/:provider", async (c) => {
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
app.post("/make-server-65e6e67f/calendar/sync-task", async (c) => {
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
app.post("/make-server-65e6e67f/calendar/sync-all", async (c) => {
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

// Get calendar events
app.get("/make-server-65e6e67f/calendar/events/:provider", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const provider = c.req.param('provider') as calendarSync.CalendarProvider;
    const startDate = c.req.query('startDate') || new Date().toISOString();
    const endDate = c.req.query('endDate') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const events = await calendarSync.getCalendarEvents(userId, provider, startDate, endDate);

    return c.json({ events });
  } catch (error) {
    console.log('Error fetching calendar events:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// APPLE CALENDAR SYNC VIA SHORTCUTS
// ============================================================================
// These endpoints are called by Apple Shortcuts for two-way calendar sync

// Get tasks to sync TO Apple Calendar (Shortcut calls this to fetch tasks)
app.get("/make-server-65e6e67f/calendar/apple/tasks", async (c) => {
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
app.post("/make-server-65e6e67f/calendar/apple/events", async (c) => {
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
    
    // Also check for sync token in body or query (for Shortcuts)
    if (!userId) {
      const body = await c.req.json().catch(() => ({}));
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

    const body = await c.req.json();
    const events = body.events || [];

    if (!Array.isArray(events)) {
      return c.json({ error: 'Events must be an array' }, 400);
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

    for (const event of events) {
      try {
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
              scheduled_date: event.startDate,
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
              scheduled_date: event.startDate,
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
app.get("/make-server-65e6e67f/calendar/apple/sync-token", async (c) => {
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
    const apiUrl = `${baseUrl}/functions/v1/make-server-65e6e67f`;

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

// Test CalDAV connection with credentials
app.post("/make-server-65e6e67f/calendar/apple/caldav/test", async (c) => {
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
});

// Discover calendars
app.post("/make-server-65e6e67f/calendar/apple/caldav/discover", async (c) => {
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
});

// Save CalDAV credentials and selected calendars
app.post("/make-server-65e6e67f/calendar/apple/caldav/save", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { email, appPassword, selectedCalendars } = await c.req.json();
    
    if (!email || !appPassword) {
      return c.json({ error: 'Email and app-specific password are required' }, 400);
    }

    // Store credentials securely in KV store (encrypted in production)
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
});

// Get CalDAV connection status
app.get("/make-server-65e6e67f/calendar/apple/caldav/status", async (c) => {
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

// Trigger CalDAV sync
app.post("/make-server-65e6e67f/calendar/apple/caldav/sync", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get stored credentials
    const credentialsJson = await kv.get(`caldav_credentials_${userId}`);
    if (!credentialsJson) {
      return c.json({ error: 'CalDAV not configured. Please connect your Apple Calendar first.' }, 400);
    }

    const storedCredentials = JSON.parse(credentialsJson);
    
    if (!storedCredentials.selectedCalendars || storedCredentials.selectedCalendars.length === 0) {
      return c.json({ error: 'No calendars selected. Please select at least one calendar to sync.' }, 400);
    }

    // Get user's workspace
    const supabase = getSupabaseClient();
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return c.json({ error: 'No workspace found' }, 400);
    }

    // Perform sync
    const result = await appleCaldavSync.syncCalendarsToDatabase(
      supabase,
      userId,
      membership.workspace_id,
      { email: storedCredentials.email, appPassword: storedCredentials.appPassword },
      storedCredentials.selectedCalendars.map((cal: any) => cal.href)
    );

    // Store sync result
    await kv.set(`caldav_last_sync_${userId}`, JSON.stringify({
      syncedAt: new Date().toISOString(),
      ...result,
    }));

    return c.json(result);
  } catch (error) {
    console.error('CalDAV sync error:', error);
    return c.json({ 
      success: false,
      error: getErrorMessage(error) 
    }, 500);
  }
});

// Disconnect CalDAV
app.delete("/make-server-65e6e67f/calendar/apple/caldav", async (c) => {
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
app.get("/make-server-65e6e67f/calendar/apple/caldav/events", async (c) => {
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

app.post("/make-server-65e6e67f/create-checkout-session", async (c) => {
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

app.post("/make-server-65e6e67f/revenuecat-webhook", async (c) => {
  try {
    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      console.error('RevenueCat webhook secret not configured');
      return c.json({ error: 'Webhook not configured' }, 500);
    }

    const signature = c.req.header('Authorization');
    
    // Verify webhook signature (RevenueCat sends Authorization header with secret)
    if (!signature || signature !== `Bearer ${webhookSecret}`) {
      console.error('Invalid RevenueCat webhook signature');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const event = await c.req.json();
    
    // Extract user ID from event
    const userId = event.event?.app_user_id || event.app_user_id;
    
    if (!userId) {
      console.error('No user ID in RevenueCat webhook event');
      return c.json({ error: 'Missing user ID' }, 400);
    }

    // Handle different event types
    const eventType = event.event?.type || event.type;
    
    console.log(`📥 RevenueCat webhook: ${eventType} for user ${userId}`);

    // Map RevenueCat entitlements to subscription tier
    const entitlements = event.event?.entitlements || event.entitlements || {};
    const hasProEntitlement = 
      entitlements.active?.['pro'] ||
      entitlements.active?.['PRO-Monthly'] ||
      entitlements.active?.['PRO-Yearly'];

    const tier = hasProEntitlement ? 'pro' : 'free';
    
    // Get subscription details
    const subscription = entitlements.active?.['pro'] ||
                        entitlements.active?.['PRO-Monthly'] ||
                        entitlements.active?.['PRO-Yearly'];

    const status = subscription?.will_renew ? 'active' : 
                   subscription?.expires_date ? 'expired' : 'inactive';
    
    const startDate = subscription?.purchase_date || null;
    const endDate = subscription?.expires_date || null;
    const cancelAtPeriodEnd = !subscription?.will_renew;

    // Determine subscription store (stripe, app_store, play_store)
    const store = subscription?.store || 'revenuecat';

    // Save subscription data
    const subscriptionData = {
      tier,
      status,
      startDate,
      endDate,
      cancelAtPeriodEnd,
    };

    // Save in both formats for compatibility
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

    console.log(`✅ RevenueCat webhook processed: ${eventType} - User ${userId} -> ${tier} (${status})`);

    return c.json({ success: true, event: eventType });
  } catch (error) {
    console.error('❌ RevenueCat webhook error:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// ============================================================================
// STRIPE WEBHOOK (if needed in the future)
// ============================================================================
// Stripe webhook endpoint can be added here for handling Stripe subscription events

// Get user subscription status (for frontend queries)
app.get("/make-server-65e6e67f/subscription-status", async (c) => {
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
// STRIPE BILLING PORTAL
// ============================================================================
// Create Stripe billing portal session for subscription management

app.post("/make-server-65e6e67f/create-billing-portal", async (c) => {
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
app.post("/make-server-65e6e67f/admin/set-user-access", async (c) => {
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
app.get("/make-server-65e6e67f/admin/get-user/:email", async (c) => {
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
app.post("/make-server-65e6e67f/team/:workspaceId/invite", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const { email, name, role } = await c.req.json();

    if (!email || !name) {
      return c.json({ error: 'Email and name are required' }, 400);
    }

    // Verify workspace exists
    const workspaceOwner = await kv.get(`workspace_${workspaceId}_owner`);
    if (!workspaceOwner) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    // Verify workspace ownership or membership
    let members = await kv.get(`workspace_${workspaceId}_members`);
    
    // Handle both array and JSON string formats
    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (e) {
        console.log('Error parsing members:', e);
        // If parsing fails, try to initialize with owner
        members = [workspaceOwner];
        await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(members));
      }
    }
    
    // Ensure members is an array
    if (!members || !Array.isArray(members)) {
      // Initialize with owner if missing
      members = [workspaceOwner];
      await kv.set(`workspace_${workspaceId}_members`, JSON.stringify(members));
    }
    
    if (!members.includes(userId)) {
      return c.json({ error: 'Unauthorized: Not a workspace member' }, 403);
    }

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days

    // Store invitation
    const invitation = {
      token: invitationToken,
      workspaceId,
      email: email.toLowerCase(),
      name,
      role: role || 'member',
      invitedBy: userId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
    };

    await kv.set(`invitation_${invitationToken}`, JSON.stringify(invitation));
    
    // Track invitations for workspace
    const existingInvitations = await kv.get(`workspace_${workspaceId}_invitations`);
    const invitations = existingInvitations ? JSON.parse(existingInvitations) : [];
    if (!invitations.includes(invitationToken)) {
      invitations.push(invitationToken);
      await kv.set(`workspace_${workspaceId}_invitations`, JSON.stringify(invitations));
    }

    // Get inviter's name for email
    const supabase = getSupabaseClient();
    let inviterName = 'Someone';
    try {
      const { data: inviterUser } = await supabase.auth.admin.getUserById(userId);
      if (inviterUser?.user) {
        inviterName = inviterUser.user.user_metadata?.name || inviterUser.user.email?.split('@')[0] || 'Someone';
      }
    } catch (err) {
      console.log('Could not fetch inviter name:', err);
    }

    // Get workspace name if available
    const workspaceName = await kv.get(`workspace_${workspaceId}_name`) || undefined;

    // Send invitation email
    const inviteLink = `https://taskzm.com/invite?token=${invitationToken}`;
    const emailResult = await emailService.sendInvitationEmail({
      to: email.toLowerCase(),
      inviterName,
      inviteeName: name,
      workspaceName,
      role: role || 'member',
      inviteLink,
      expiresInDays: 7,
    });

    if (emailResult.success) {
      console.log(`✅ Invitation email sent to ${email} for workspace ${workspaceId}`);
    } else {
      console.warn(`⚠️ Failed to send invitation email to ${email}:`, emailResult.error);
      // Don't fail the invitation if email fails - still return success
    }

    return c.json({
      invitation: {
        ...invitation,
        token: invitationToken,
        expiresAt: invitation.expiresAt,
      },
      inviteLink: `https://taskzm.com/invite?token=${invitationToken}`,
    });
  } catch (error) {
    console.log('Error sending invitation:', error);
    return c.json({ error: getErrorMessage(error) }, 500);
  }
});

// Get team members
app.get("/make-server-65e6e67f/team/:workspaceId/members", async (c) => {
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
            if (invitation.status === 'pending') {
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
app.delete("/make-server-65e6e67f/team/:workspaceId/members/:memberId", async (c) => {
  try {
    const { userId, error: authError } = await verifyUser(c.req.raw);
    if (authError || !userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const memberId = c.req.param('memberId');

    // Verify workspace ownership (only owner can remove members)
    const owner = await kv.get(`workspace_${workspaceId}_owner`);
    if (owner !== userId) {
      return c.json({ error: 'Unauthorized: Only workspace owner can remove members' }, 403);
    }

    // Can't remove yourself
    if (memberId === userId) {
      return c.json({ error: 'Cannot remove yourself from workspace' }, 400);
    }

    // Handle pending invitations (IDs starting with "pending_")
    if (memberId.startsWith('pending_')) {
      // Extract token from ID (format: "pending_<token>")
      const token = memberId.replace('pending_', '');
      
      // Remove invitation
      await kv.del(`invitation_${token}`);
      
      // Remove from workspace invitations list
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
app.put("/make-server-65e6e67f/team/:workspaceId/members/:memberId/role", async (c) => {
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

    // Verify workspace ownership (only owner can change roles)
    const owner = await kv.get(`workspace_${workspaceId}_owner`);
    if (owner !== userId) {
      return c.json({ error: 'Unauthorized: Only workspace owner can change roles' }, 403);
    }

    // Verify member exists
    // Handle pending invitations (IDs starting with "pending_")
    if (memberId.startsWith('pending_')) {
      // For pending invitations, we can't update role until they accept
      return c.json({ error: 'Cannot update role for pending invitation. Wait for member to accept.' }, 400);
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
app.post("/make-server-65e6e67f/team/invitations/validate", async (c) => {
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
app.post("/make-server-65e6e67f/team/invitations/accept", async (c) => {
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

    // Mark invitation as accepted
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date().toISOString();
    invitation.acceptedBy = userId;
    await kv.set(`invitation_${token}`, JSON.stringify(invitation));

    // Send notification to inviter (optional, don't fail if it fails)
    try {
      const { data: inviterUser } = await supabase.auth.admin.getUserById(invitation.invitedBy);
      if (inviterUser?.user?.email) {
        const workspaceName = await kv.get(`workspace_${workspaceId}_name`) || undefined;
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
app.post("/make-server-65e6e67f/team/:workspaceId/invitations/resend", async (c) => {
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
    const workspaceName = await kv.get(`workspace_${workspaceId}_name`) || undefined;

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
app.post("/make-server-65e6e67f/team/:workspaceId/invitations/decline", async (c) => {
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

// Catch-all route for debugging 404 errors
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
    availableRoutes: [
      'GET /make-server-65e6e67f/calendar/status',
      'POST /make-server-65e6e67f/calendar/apple/setup',
      'GET /make-server-65e6e67f/calendar/google/auth',
      'GET /make-server-65e6e67f/calendar/google/callback',
      'GET /make-server-65e6e67f/calendar/outlook/auth',
      'GET /make-server-65e6e67f/calendar/outlook/callback',
      'DELETE /make-server-65e6e67f/calendar/:provider',
      'POST /make-server-65e6e67f/calendar/sync-task',
      'POST /make-server-65e6e67f/calendar/sync-all',
    ]
  }, 404);
});

Deno.serve(app.fetch);


