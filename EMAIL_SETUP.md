# Email Notifications Setup Guide

## Overview

Email notifications for team invitations have been implemented using **Resend**. This guide will help you set up email sending for your TaskZM application.

## Features

- ✅ **Invitation Emails**: Automatically sent when inviting team members
- ✅ **Resend Invitations**: Emails sent when resending expired invitations
- ✅ **Acceptance Notifications**: Optional notifications to inviters when invitations are accepted
- ✅ **Graceful Degradation**: System continues to work even if email service is not configured

## Setup Instructions

### 1. Create a Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account (100 emails/day free tier)
3. Verify your email address

### 2. Get Your API Key

1. Navigate to **API Keys** in your Resend dashboard
2. Click **Create API Key**
3. Give it a name (e.g., "TaskZM Production")
4. Copy the API key (you won't be able to see it again)

### 3. Configure Domain (Recommended)

For production, you should verify your domain:

1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter your domain (e.g., `taskzm.com`)
4. Add the DNS records provided by Resend to your domain's DNS settings
5. Wait for verification (usually a few minutes)

**Note**: For testing, you can use Resend's default domain, but emails may go to spam.

### 4. Set Environment Variables

Add the following environment variables to your Supabase Edge Function:

#### Required:
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
```

#### Optional:
```bash
# Custom "from" email address (must be verified domain)
RESEND_FROM_EMAIL=TaskZM <invites@taskzm.com>

# App URL for email links (defaults to https://taskzm.com)
APP_URL=https://taskzm.com
```

### 5. Setting Environment Variables in Supabase

#### Option A: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Settings**
3. Add environment variables under **Secrets**
4. Add:
   - `RESEND_API_KEY` = your Resend API key
   - `RESEND_FROM_EMAIL` = your verified email (optional)
   - `APP_URL` = your app URL (optional)

#### Option B: Supabase CLI
```bash
# Set environment variables
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
supabase secrets set RESEND_FROM_EMAIL="TaskZM <invites@taskzm.com>"
supabase secrets set APP_URL="https://taskzm.com"
```

## Email Templates

The email service includes beautiful HTML email templates with:
- Branded TaskZM styling
- Clear invitation details
- Role information (Admin/Member/Viewer)
- Expiration notice
- Mobile-responsive design
- Plain text fallback

## Testing

### Test Email Sending

1. **Without API Key** (Development):
   - System will log the invitation link but not send email
   - Check console logs: `📧 Would send invitation email to...`

2. **With API Key** (Production):
   - Invitations are automatically sent
   - Check Resend dashboard → **Emails** to see sent emails
   - Check console logs: `✅ Invitation email sent to...`

### Test Invitation Flow

1. Invite a team member through the Team Panel
2. Check the invitee's email inbox (and spam folder)
3. Click the invitation link
4. Verify the invitation acceptance page loads correctly

## Troubleshooting

### Emails Not Sending

1. **Check API Key**:
   - Verify `RESEND_API_KEY` is set correctly
   - Check Resend dashboard → **API Keys** to confirm it's active

2. **Check Domain Verification**:
   - If using custom domain, ensure DNS records are correct
   - Use Resend's default domain for testing

3. **Check Logs**:
   - View Supabase Edge Function logs
   - Look for error messages in console

4. **Check Spam Folder**:
   - Emails may go to spam if domain is not verified
   - Ask invitees to check spam/junk folder

### Common Errors

**Error: "Invalid API key"**
- Verify your API key is correct
- Check for extra spaces or characters
- Regenerate API key if needed

**Error: "Domain not verified"**
- Verify your domain in Resend dashboard
- Wait for DNS propagation (can take up to 48 hours)
- Use Resend's default domain for testing

**Error: "Rate limit exceeded"**
- Free tier: 100 emails/day
- Upgrade to paid plan for more emails
- Check Resend dashboard for usage

## Email Content Customization

To customize email templates, edit:
- `src/supabase/functions/server/email-service.tsx`
- Modify the `htmlContent` and `textContent` in `sendInvitationEmail()`

## Cost

- **Free Tier**: 100 emails/day
- **Paid Plans**: Starting at $20/month for 50,000 emails
- See [Resend Pricing](https://resend.com/pricing) for details

## Alternative Email Services

If you prefer a different email service, you can modify `email-service.tsx` to use:
- **SendGrid**: Similar API structure
- **Mailgun**: Transactional email service
- **AWS SES**: Amazon's email service
- **Postmark**: Developer-friendly email service

## Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Rotate API keys periodically
- Monitor email sending for abuse

## Support

- **Resend Documentation**: https://resend.com/docs
- **Resend Support**: support@resend.com
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions

