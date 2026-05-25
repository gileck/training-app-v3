import { appConfig } from '@/app.config';
import { sendNotificationToOwner } from '@/server/template/telegram';
import { users } from '@/server/database';
import { escapeHtml } from '@/pages/api/telegram-webhook/utils';
import type { RpcConnection } from '@/server/database/collections/template/rpc-connections/types';

export const RPC_CONN_APPROVE_ACTION = 'rpc_conn_approve';
export const RPC_CONN_REJECT_ACTION = 'rpc_conn_reject';

export async function sendRpcConnectionApprovalRequest(
  connection: RpcConnection
): Promise<{ success: boolean; error?: string }> {
  if (!appConfig.ownerTelegramChatId) {
    return { success: false, error: 'Owner Telegram chat ID is not configured.' };
  }

  const user = await users.findUserById(connection.userId).catch(() => null);
  const username = user?.username ?? connection.userId;
  const id = connection._id.toString();

  const message = [
    '🔌 <b>RPC Connection Request</b>',
    '',
    `App: <b>${escapeHtml(appConfig.appName)}</b>`,
    `User: <b>${escapeHtml(username)}</b>`,
    `Time: ${connection.requestedAt.toISOString()}`,
    `Device: ${escapeHtml(connection.userAgent || 'unknown')}`,
    `IP: ${escapeHtml(connection.ip || 'unknown')}`,
    '',
    'Approve to grant RPC access for the configured TTL.',
  ].join('\n');

  const sent = await sendNotificationToOwner(message, {
    parseMode: 'HTML',
    inlineKeyboard: [[
      { text: '✅ Approve', callback_data: `${RPC_CONN_APPROVE_ACTION}:${id}` },
      { text: '❌ Reject', callback_data: `${RPC_CONN_REJECT_ACTION}:${id}` },
    ]],
  });

  return sent.success ? { success: true } : { success: false, error: sent.error };
}
