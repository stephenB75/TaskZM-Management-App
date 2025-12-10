/**
 * Email service for sending invitation emails
 * Uses Resend API for email delivery
 */

interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  inviteeName: string;
  workspaceName?: string;
  role: 'admin' | 'member' | 'viewer';
  inviteLink: string;
  expiresInDays?: number;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send team invitation email
 */
export async function sendInvitationEmail(params: SendInvitationEmailParams): Promise<EmailResult> {
  const {
    to,
    inviterName,
    inviteeName,
    role,
    inviteLink,
    expiresInDays = 7,
  } = params;

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  // If Resend API key is not configured, log and return success (graceful degradation)
  if (!resendApiKey) {
    console.warn('⚠️ RESEND_API_KEY not configured. Email will not be sent.');
    console.log(`📧 Would send invitation email to ${to} with link: ${inviteLink}`);
    return {
      success: true,
      messageId: 'no-api-key',
      error: 'Email service not configured',
    };
  }

  const appUrl = Deno.env.get('APP_URL') || 'https://taskzm.com';
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'TaskZM <invites@taskzm.com>';

  // Role display names
  const roleDisplay = {
    admin: 'Administrator',
    member: 'Member',
    viewer: 'Viewer',
  };

  // Role descriptions
  const roleDescription = {
    admin: 'Full access to manage tasks and team members',
    member: 'Can create and edit tasks',
    viewer: 'Read-only access to view tasks',
  };

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to join TaskZM</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      background: linear-gradient(135deg, #9B87E8 0%, #7A9AC9 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 10px;
    }
    .title {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 16px;
      color: #666;
      margin-bottom: 30px;
    }
    .content {
      margin-bottom: 30px;
    }
    .invitation-details {
      background-color: #f8f9fa;
      border-left: 4px solid #9B87E8;
      padding: 20px;
      border-radius: 4px;
      margin: 20px 0;
    }
    .detail-row {
      margin-bottom: 10px;
    }
    .detail-label {
      font-weight: 600;
      color: #555;
      display: inline-block;
      width: 100px;
    }
    .detail-value {
      color: #333;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #9B87E8 0%, #7A9AC9 100%);
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      transition: opacity 0.2s;
    }
    .button:hover {
      opacity: 0.9;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 14px;
      color: #666;
      text-align: center;
    }
    .expiry-notice {
      font-size: 13px;
      color: #888;
      margin-top: 20px;
      text-align: center;
    }
    .link-fallback {
      margin-top: 20px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 4px;
      font-size: 13px;
      word-break: break-all;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">TaskZM</div>
      <div class="title">You've been invited!</div>
      <div class="subtitle">Join your team on TaskZM</div>
    </div>

    <div class="content">
      <p>Hi ${inviteeName},</p>
      
      <p><strong>${inviterName}</strong> has invited you to join their team on TaskZM, an AI-powered task management platform.</p>

      <div class="invitation-details">
        <div class="detail-row">
          <span class="detail-label">Role:</span>
          <span class="detail-value"><strong>${roleDisplay[role]}</strong> - ${roleDescription[role]}</span>
        </div>
      </div>

      <p>Click the button below to accept the invitation and get started:</p>
    </div>

    <div class="button-container">
      <a href="${inviteLink}" class="button">Accept Invitation</a>
    </div>

    <div class="link-fallback">
      <p style="margin: 0 0 8px 0; font-weight: 600;">Or copy and paste this link:</p>
      <p style="margin: 0; word-break: break-all;">${inviteLink}</p>
    </div>

    <div class="expiry-notice">
      This invitation expires in ${expiresInDays} day${expiresInDays !== 1 ? 's' : ''}.
    </div>

    <div class="footer">
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p style="margin-top: 10px;">
        <a href="${appUrl}" style="color: #9B87E8; text-decoration: none;">Visit TaskZM</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
You've been invited to join TaskZM!

Hi ${inviteeName},

${inviterName} has invited you to join their team on TaskZM, an AI-powered task management platform.

Role: ${roleDisplay[role]} - ${roleDescription[role]}

Accept your invitation by clicking the link below:
${inviteLink}

This invitation expires in ${expiresInDays} day${expiresInDays !== 1 ? 's' : ''}.

If you didn't expect this invitation, you can safely ignore this email.

Visit TaskZM: ${appUrl}
  `.trim();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `${inviterName} invited you to join TaskZM`,
        html: htmlContent,
        text: textContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Resend API error:', errorData);
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    console.log(`✅ Invitation email sent to ${to} (Message ID: ${data.id})`);
    
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send invitation acceptance notification (optional)
 * Notifies the inviter when someone accepts their invitation
 */
export async function sendInvitationAcceptedNotification(
  inviterEmail: string,
  inviteeName: string,
  workspaceName?: string
): Promise<EmailResult> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    // Silently skip if not configured
    return { success: true };
  }

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'TaskZM <notifications@taskzm.com>';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${inviteeName} accepted your invitation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      background: linear-gradient(135deg, #9B87E8 0%, #7A9AC9 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin-top: 20px;
    }
    .content {
      margin: 20px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #9B87E8 0%, #7A9AC9 100%);
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">TaskZM</div>
      <div class="title">${inviteeName} accepted your invitation!</div>
    </div>
    <div class="content">
      <p>Great news! <strong>${inviteeName}</strong> has accepted your invitation and joined your team.</p>
      <p>They can now collaborate with you on tasks and projects.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [inviterEmail],
        subject: `${inviteeName} accepted your TaskZM invitation`,
        html: htmlContent,
      }),
    });

    if (!response.ok) {
      // Don't fail the invitation acceptance if notification fails
      console.warn('Failed to send acceptance notification:', await response.text());
      return { success: false };
    }

    return { success: true, messageId: (await response.json()).id };
  } catch (error) {
    // Don't fail the invitation acceptance if notification fails
    console.warn('Error sending acceptance notification:', error);
    return { success: false };
  }
}

