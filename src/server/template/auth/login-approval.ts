import type { User } from '@/server/database/collections/template/users/types';
import { loginApprovals } from '@/server/database';
import { appConfig } from '@/app.config';
import { sendTelegramNotification } from '@/server/template/telegram';
import { sendEmail } from '@/server/template/email';
import type { TwoFactorMethod } from '@/apis/template/auth/types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || '*'}*@${domain}`;
  }

  return `${localPart[0]}${'*'.repeat(Math.max(1, localPart.length - 2))}${localPart[localPart.length - 1]}@${domain}`;
}

function resolveUserTwoFactorSettings(user: User): {
  enabled: boolean;
  method?: TwoFactorMethod;
} {
  const enabled = user.twoFactorEnabled ?? user.telegramTwoFactorEnabled ?? false;
  const method = user.twoFactorMethod
    ?? (user.telegramTwoFactorEnabled ? 'telegram' : undefined)
    ?? (user.email ? 'email' : user.telegramChatId ? 'telegram' : undefined);

  return { enabled, method };
}

async function createTelegramLoginApproval(user: User) {
  if (!user.telegramChatId) {
    return { error: 'Telegram chat ID is not configured for this account.' } as const;
  }

  const approval = await loginApprovals.createLoginApproval({
    userId: user._id,
    username: user.username,
    method: 'telegram',
  });

  const sent = await sendTelegramNotification(
    user.telegramChatId,
    [
      '🔐 <b>Login approval requested</b>',
      '',
      `App: <b>${escapeHtml(appConfig.appName)}</b>`,
      `User: <b>${escapeHtml(user.username)}</b>`,
      '',
      'If this was you, approve the login below.',
    ].join('\n'),
    {
      parseMode: 'HTML',
      inlineKeyboard: [[
        {
          text: '✅ Approve Login',
          callback_data: `approve_login:${approval._id.toString()}`,
        },
      ]],
    }
  );

  if (!sent.success) {
    await loginApprovals.deleteLoginApproval(approval._id);
    return { error: sent.error || 'Failed to send Telegram login approval' } as const;
  }

  return {
    approvalId: approval._id.toString(),
    approvalToken: approval.browserToken,
    approvalMethod: 'telegram' as const,
    approvalHint: 'Telegram',
    expiresAt: approval.expiresAt.toISOString(),
  };
}

async function createEmailLoginApproval(user: User) {
  if (!user.email) {
    return { error: 'Email is not configured for this account.' } as const;
  }

  const approval = await loginApprovals.createLoginApproval({
    userId: user._id,
    username: user.username,
    method: 'email',
  });

  const approvalUrl = `${appConfig.appUrl.replace(/\/$/, '')}/api/login-approvals/approve?approvalId=${encodeURIComponent(approval._id.toString())}&token=${encodeURIComponent(approval.externalApprovalToken)}`;

  const sent = await sendEmail({
    to: user.email,
    subject: `${appConfig.appName}: approve your sign-in`,
    text: [
      `A sign-in was requested for ${appConfig.appName}.`,
      '',
      `Username: ${user.username}`,
      '',
      `Approve the sign-in by opening this link:`,
      approvalUrl,
      '',
      `This link expires at ${approval.expiresAt.toISOString()}.`,
    ].join('\n'),
    html: [
      '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">',
      `<h2 style="margin:0 0 16px;">Approve your sign-in</h2>`,
      `<p style="margin:0 0 12px;">A sign-in was requested for <strong>${escapeHtml(appConfig.appName)}</strong>.</p>`,
      `<p style="margin:0 0 20px;">Username: <strong>${escapeHtml(user.username)}</strong></p>`,
      `<p style="margin:0 0 20px;"><a href="${approvalUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;">Approve sign-in</a></p>`,
      `<p style="margin:0;color:#6b7280;font-size:14px;">This link expires at ${escapeHtml(approval.expiresAt.toISOString())}.</p>`,
      '</div>',
    ].join(''),
  });

  if (!sent.success) {
    await loginApprovals.deleteLoginApproval(approval._id);
    return { error: sent.error || 'Failed to send email login approval' } as const;
  }

  return {
    approvalId: approval._id.toString(),
    approvalToken: approval.browserToken,
    approvalMethod: 'email' as const,
    approvalHint: maskEmail(user.email),
    expiresAt: approval.expiresAt.toISOString(),
  };
}

export async function createTwoFactorLoginApproval(user: User): Promise<{
  approvalId: string;
  approvalToken: string;
  approvalMethod: TwoFactorMethod;
  approvalHint: string;
  expiresAt: string;
} | {
  error: string;
}> {
  const settings = resolveUserTwoFactorSettings(user);

  if (!settings.enabled) {
    return { error: '2-factor authentication is not enabled for this account.' };
  }

  if (settings.method === 'telegram') {
    return createTelegramLoginApproval(user);
  }

  if (settings.method === 'email') {
    return createEmailLoginApproval(user);
  }

  return { error: 'No valid 2-factor authentication method is configured for this account.' };
}
