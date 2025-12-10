/**
 * Demo User Cleanup Utilities
 * 
 * This file contains utility functions for cleaning up demo users and their data.
 * Can be used for manual cleanup or scheduled cleanup jobs.
 */

import * as kv from './kv_store.tsx';

/**
 * Get all demo user IDs from the KV store
 */
export async function getAllDemoUserIds(): Promise<string[]> {
  const demoFlags = await kv.getByPrefix('user_');
  const demoUserIds: string[] = [];

  for (const item of demoFlags) {
    if (item.key.endsWith('_is_demo') && item.value === 'true') {
      // Extract user ID from key: user_[userId]_is_demo
      const userId = item.key.replace('user_', '').replace('_is_demo', '');
      demoUserIds.push(userId);
    }
  }

  return demoUserIds;
}

/**
 * Delete all data for a specific user ID
 */
export async function deleteUserData(userId: string): Promise<{
  success: boolean;
  deletedKeys: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let deletedKeys = 0;

  try {
    // 1. Get and delete workspace data
    const workspaceId = await kv.get(`user_${userId}_workspace`);
    
    if (workspaceId) {
      const workspaceKeys = await kv.getByPrefix(`workspace_${workspaceId}_`);
      
      for (const item of workspaceKeys) {
        try {
          await kv.del(item.key);
          deletedKeys++;
        } catch (error) {
          errors.push(`Failed to delete ${item.key}: ${error}`);
        }
      }
    }

    // 2. Delete user-specific data
    const userKeys = await kv.getByPrefix(`user_${userId}_`);
    
    for (const item of userKeys) {
      try {
        await kv.del(item.key);
        deletedKeys++;
      } catch (error) {
        errors.push(`Failed to delete ${item.key}: ${error}`);
      }
    }

    // 3. Delete calendar tokens
    try {
      await kv.del(`calendar_tokens_${userId}_google`);
      await kv.del(`calendar_tokens_${userId}_outlook`);
      await kv.del(`calendar_tokens_${userId}_apple`);
      deletedKeys += 3;
    } catch (error) {
      // Calendar tokens might not exist - that's okay
    }

    return {
      success: errors.length === 0,
      deletedKeys,
      errors,
    };
  } catch (error) {
    errors.push(`General error: ${error}`);
    return {
      success: false,
      deletedKeys,
      errors,
    };
  }
}

/**
 * Get statistics about demo users
 */
export async function getDemoUserStats(): Promise<{
  totalDemoUsers: number;
  estimatedStorageKeys: number;
}> {
  const demoUserIds = await getAllDemoUserIds();
  let totalKeys = 0;

  for (const userId of demoUserIds) {
    const workspaceId = await kv.get(`user_${userId}_workspace`);
    
    if (workspaceId) {
      const workspaceKeys = await kv.getByPrefix(`workspace_${workspaceId}_`);
      totalKeys += workspaceKeys.length;
    }

    const userKeys = await kv.getByPrefix(`user_${userId}_`);
    totalKeys += userKeys.length;
  }

  return {
    totalDemoUsers: demoUserIds.length,
    estimatedStorageKeys: totalKeys,
  };
}

/**
 * Clean up all demo users (use with caution!)
 */
export async function cleanupAllDemoUsers(): Promise<{
  cleaned: number;
  failed: number;
  totalKeysDeleted: number;
  errors: string[];
}> {
  const demoUserIds = await getAllDemoUserIds();
  let cleaned = 0;
  let failed = 0;
  let totalKeysDeleted = 0;
  const allErrors: string[] = [];

  for (const userId of demoUserIds) {
    const result = await deleteUserData(userId);
    
    if (result.success) {
      cleaned++;
      totalKeysDeleted += result.deletedKeys;
    } else {
      failed++;
      allErrors.push(...result.errors);
    }
  }

  return {
    cleaned,
    failed,
    totalKeysDeleted,
    errors: allErrors,
  };
}

/**
 * Find and clean up stale demo users (older than X hours)
 * Note: Requires storing creation timestamp in user metadata or KV
 */
export async function cleanupStaleDemoUsers(maxAgeHours: number = 24): Promise<{
  cleaned: number;
  kept: number;
  totalKeysDeleted: number;
}> {
  // This is a placeholder - would need to track user creation time
  // to implement properly. For now, returns stats without action.
  const stats = await getDemoUserStats();
  
  return {
    cleaned: 0,
    kept: stats.totalDemoUsers,
    totalKeysDeleted: 0,
  };
}

/**
 * Verify cleanup for a specific user
 */
export async function verifyUserCleanup(userId: string): Promise<{
  isClean: boolean;
  remainingKeys: string[];
}> {
  const workspaceId = await kv.get(`user_${userId}_workspace`);
  const remainingKeys: string[] = [];

  // Check for workspace keys
  if (workspaceId) {
    const workspaceKeys = await kv.getByPrefix(`workspace_${workspaceId}_`);
    remainingKeys.push(...workspaceKeys.map(k => k.key));
  }

  // Check for user keys
  const userKeys = await kv.getByPrefix(`user_${userId}_`);
  remainingKeys.push(...userKeys.map(k => k.key));

  return {
    isClean: remainingKeys.length === 0,
    remainingKeys,
  };
}

/**
 * Export cleanup report
 */
export function generateCleanupReport(stats: {
  cleaned: number;
  failed: number;
  totalKeysDeleted: number;
  errors: string[];
}): string {
  return `
Demo User Cleanup Report
========================
Date: ${new Date().toISOString()}

Summary:
- Users Cleaned: ${stats.cleaned}
- Users Failed: ${stats.failed}
- Total Keys Deleted: ${stats.totalKeysDeleted}

${stats.errors.length > 0 ? `
Errors:
${stats.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}
` : 'No errors encountered.'}

Storage Saved: ~${(stats.totalKeysDeleted * 0.5).toFixed(2)} KB (estimated)
`;
}
