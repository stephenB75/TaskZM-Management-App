# Demo Account Cleanup - Scheduled Job Setup

This document explains how to set up automated cleanup of inactive demo accounts.

## Overview

The demo account system includes an endpoint that cleans up demo users who have been inactive for more than a specified time period (default: 60 minutes). To automate this process, you need to set up a scheduled job (cron job) that calls this endpoint periodically.

## Endpoint Details

**Endpoint**: `POST /make-server-65e6e67f/demo/cleanup-inactive`

**Base URL**: `https://{your-project-id}.supabase.co/functions/v1`

**Authentication**: Requires either:
- Admin user authentication, OR
- Scheduled job secret token (recommended for automated jobs)

**Request Body**:
```json
{
  "scheduledJobToken": "your-secret-token",
  "maxInactiveMinutes": 60
}
```

**Response**:
```json
{
  "success": true,
  "cleanedCount": 5,
  "totalChecked": 10,
  "errors": []
}
```

## Setup Options

### Option 1: Supabase Edge Functions Cron Jobs (Recommended)

Supabase supports scheduled Edge Functions using pg_cron. However, since this is a Deno Edge Function, you'll need to use an external cron service.

### Option 2: External Cron Service (Recommended)

Use a service like:
- **Cron-job.org** (Free tier available)
- **EasyCron** (Free tier available)
- **GitHub Actions** (Free for public repos)
- **Vercel Cron** (If using Vercel)
- **AWS EventBridge** (If using AWS)

### Option 3: GitHub Actions (Free)

Create `.github/workflows/demo-cleanup.yml`:

```yaml
name: Demo Account Cleanup

on:
  schedule:
    # Run every hour
    - cron: '0 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup Inactive Demo Accounts
        run: |
          curl -X POST \
            "https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co/functions/v1/make-server-65e6e67f/demo/cleanup-inactive" \
            -H "Content-Type: application/json" \
            -d '{
              "scheduledJobToken": "${{ secrets.SCHEDULED_JOB_SECRET }}",
              "maxInactiveMinutes": 60
            }'
```

**Required Secrets**:
- `SUPABASE_PROJECT_ID`: Your Supabase project ID
- `SCHEDULED_JOB_SECRET`: The secret token (set in Supabase environment variables)

### Option 4: Cron-job.org Setup

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Create a new cron job:
   - **URL**: `https://{your-project-id}.supabase.co/functions/v1/make-server-65e6e67f/demo/cleanup-inactive`
   - **Method**: POST
   - **Request Body**:
     ```json
     {
       "scheduledJobToken": "your-secret-token",
       "maxInactiveMinutes": 60
     }
     ```
   - **Headers**: `Content-Type: application/json`
   - **Schedule**: Every hour (`0 * * * *`)

### Option 5: Vercel Cron (If using Vercel)

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cleanup-demo",
      "schedule": "0 * * * *"
    }
  ]
}
```

Create `api/cleanup-demo.ts`:

```typescript
export default async function handler(req, res) {
  const response = await fetch(
    `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co/functions/v1/make-server-65e6e67f/demo/cleanup-inactive`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scheduledJobToken: process.env.SCHEDULED_JOB_SECRET,
        maxInactiveMinutes: 60,
      }),
    }
  );

  const data = await response.json();
  res.status(200).json(data);
}
```

## Environment Variables

Set the following in your Supabase project:

1. Go to **Project Settings** → **Edge Functions** → **Environment Variables**
2. Add:
   - `SCHEDULED_JOB_SECRET`: A secure random string (e.g., generate with `openssl rand -hex 32`)

## Recommended Schedule

- **Frequency**: Every hour (`0 * * * *`)
- **Inactive Threshold**: 60 minutes (configurable)
- **Rationale**: Balances cleanup efficiency with user experience

## Monitoring

### Check Cleanup Status

Call the admin stats endpoint:

```bash
curl -X GET \
  "https://{project-id}.supabase.co/functions/v1/make-server-65e6e67f/admin/demo-stats" \
  -H "Authorization: Bearer {admin-token}"
```

### Manual Cleanup Trigger

You can manually trigger cleanup by calling the endpoint:

```bash
curl -X POST \
  "https://{project-id}.supabase.co/functions/v1/make-server-65e6e67f/demo/cleanup-inactive" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "maxInactiveMinutes": 60
  }'
```

## Testing

1. Create a demo account
2. Wait for inactivity (or manually set old timestamp in KV store)
3. Trigger cleanup manually
4. Verify account is deleted

## Troubleshooting

### Cleanup Not Running
- Check cron job is active
- Verify `SCHEDULED_JOB_SECRET` matches
- Check Supabase function logs

### Too Many Demo Accounts
- Reduce `maxInactiveMinutes` threshold
- Increase cleanup frequency
- Check if cleanup is actually running

### Cleanup Failing
- Check Supabase function logs
- Verify admin permissions
- Check KV store access

## Security Notes

- **Never commit** `SCHEDULED_JOB_SECRET` to version control
- Use strong, random secrets
- Rotate secrets periodically
- Monitor for unauthorized access attempts

