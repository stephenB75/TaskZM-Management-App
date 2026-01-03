/**
 * Workspace Utilities
 * 
 * Centralized workspace checking and creation utilities
 */

import * as api from './api';
import { logger } from './logger';

const WORKSPACE_NAME_FALLBACK = 'Workspace';
const WORKSPACE_NAME_SUFFIX = "'s Workspace";

/**
 * Ensure workspace exists, creating it if necessary
 * Returns the workspace ID
 */
export async function ensureWorkspaceExists(
  userId: string,
  userName: string | null | undefined,
  accessToken: string
): Promise<string> {
  if (!userId || !accessToken) {
    throw new Error('User ID and access token are required');
  }

  try {
    // Check if workspace already exists
    const { workspaces } = await api.getUserWorkspaces();
    if (workspaces && workspaces.length > 0 && workspaces[0].id) {
      const workspaceId = workspaces[0].id;
      logger.debug('Workspace already exists:', workspaceId);
      return workspaceId;
    }

    // Create new workspace
    const workspaceName = `${userName || WORKSPACE_NAME_FALLBACK}${WORKSPACE_NAME_SUFFIX}`;
    logger.info('Creating new workspace:', workspaceName);
    const workspaceId = await api.createWorkspace(workspaceName);
    
    if (!workspaceId) {
      throw new Error('Workspace creation returned no workspace ID');
    }
    
    logger.info('Workspace created successfully:', workspaceId);
    return workspaceId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      // Workspace not found - this is expected for new users
      logger.debug('Workspace not found (expected for new users), creating...');
      const workspaceName = `${userName || WORKSPACE_NAME_FALLBACK}${WORKSPACE_NAME_SUFFIX}`;
      const workspaceId = await api.createWorkspace(workspaceName);
      if (!workspaceId) {
        throw new Error('Workspace creation failed');
      }
      return workspaceId;
    }
    throw error;
  }
}

/**
 * Check if workspace exists
 * Returns workspace ID if exists, null otherwise
 */
export async function checkWorkspaceExists(): Promise<string | null> {
  try {
    const { workspaces } = await api.getUserWorkspaces();
    if (workspaces && workspaces.length > 0 && workspaces[0].id) {
      return workspaces[0].id;
    }
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return null;
    }
    throw error;
  }
}

