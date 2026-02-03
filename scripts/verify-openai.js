#!/usr/bin/env node
/**
 * Verify OpenAI is configured and (optionally) working for task description generation.
 * Uses the same project/API base as test-database-functions.js.
 *
 * Usage:
 *   node scripts/verify-openai.js                    # Check configured only (no auth)
 *   node scripts/verify-openai.js --live TOKEN       # Check with a live description call (Bearer TOKEN)
 */

const projectId = process.env.SUPABASE_PROJECT_ID || 'gflesnyfpxqhaunfskrw';
const publicAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbGVzbnlmcHhxaGF1bmZza3J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDQwMTcsImV4cCI6MjA3Njg4MDAxN30.t6bH6nO7shmf_Am9mxllbQDhNeVaN249p1MYcF8DvtM';
const API_BASE = `https://${projectId}.supabase.co/functions/v1/taskzm-database-function`;

async function checkStatus() {
  const res = await fetch(`${API_BASE}/ai/status`, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });
  if (res.status === 404) {
    const err = new Error('ai/status not found (404). Deploy the Edge Function to add the OpenAI status endpoint.');
    err.code = 'NOT_DEPLOYED';
    throw err;
  }
  if (!res.ok) {
    throw new Error(`ai/status failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.configured === true;
}

async function checkLive(token) {
  const res = await fetch(`${API_BASE}/ai/description`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      taskName: 'Verify OpenAI integration',
      domain: 'business',
      effortScore: 2.5,
    }),
  });
  if (res.status === 503) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Server AI not configured (503)');
  }
  if (res.status === 401) {
    throw new Error('Unauthorized (401) - invalid or missing token');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ai/description failed: ${res.status} ${text || res.statusText}`);
  }
  const data = await res.json();
  if (!data.description || typeof data.description !== 'string') {
    throw new Error('Invalid response: missing description');
  }
  return data.description;
}

async function main() {
  const args = process.argv.slice(2);
  const liveIndex = args.indexOf('--live');
  const token = liveIndex >= 0 ? args[liveIndex + 1] : null;

  console.log('OpenAI verification for TaskZM\n');
  console.log('API base:', API_BASE);

  try {
    const configured = await checkStatus();
    if (!configured) {
      console.log('\nResult: OpenAI is NOT configured.');
      console.log('Set OPENAI_API_KEY in Supabase Dashboard → Project Settings → Edge Functions → Secrets.');
      process.exit(1);
    }
    console.log('\nConfigured: yes (OPENAI_API_KEY is set on the Edge Function)');

    if (token) {
      console.log('\nRunning live description test...');
      const description = await checkLive(token);
      console.log('Live call: success');
      console.log('Sample description:', description.slice(0, 120) + (description.length > 120 ? '...' : ''));
    } else {
      console.log('\nTo test a live OpenAI call, run:');
      console.log('  node scripts/verify-openai.js --live YOUR_SUPABASE_ACCESS_TOKEN');
    }

    console.log('\nOpenAI is working.');
    process.exit(0);
  } catch (err) {
    console.error('\nError:', err.message);
    if (err.code === 'NOT_DEPLOYED') {
      console.log('  Deploy with: supabase functions deploy taskzm-database-function');
    }
    process.exit(1);
  }
}

main();
