/* eslint-disable restrict-api-routes/no-direct-api-routes */
import {
  approveRpcConnection,
  endRpcConnection,
  findRpcConnectionById,
  rejectPendingRpcConnection,
} from '@/server/database/collections/template/rpc-connections/rpc-connections';
import { RPC_CONNECTION_TTL_MS } from '@/server/template/rpc/config';
import { editMessageText } from '../telegram-api';
import { escapeHtml } from '../utils';
import type { HandlerResult, TelegramCallbackQuery } from '../types';

async function noteMessage(
  botToken: string,
  callbackQuery: TelegramCallbackQuery,
  suffixHtml: string
): Promise<void> {
  if (!callbackQuery.message) return;
  await editMessageText(
    botToken,
    callbackQuery.message.chat.id,
    callbackQuery.message.message_id,
    `${escapeHtml(callbackQuery.message.text || '')}\n\n${suffixHtml}`,
    'HTML'
  );
}

/**
 * Render the right rejection note when a state-changing update didn't apply.
 * Called only on the unhappy path — happy path skips this DB read entirely.
 */
async function explainFailure(
  botToken: string,
  callbackQuery: TelegramCallbackQuery,
  connectionId: string
): Promise<HandlerResult> {
  const existing = await findRpcConnectionById(connectionId);
  if (!existing) {
    await noteMessage(botToken, callbackQuery, '⚠️ <b>Unknown connection request</b>');
    return { success: false, error: 'Unknown connection request' };
  }
  if (existing.status === 'pending' && existing.pendingExpiresAt.getTime() <= Date.now()) {
    await endRpcConnection(existing._id, 'pending_timeout');
    await noteMessage(botToken, callbackQuery, '⏰ <b>Expired</b> (no response in time)');
    return { success: false, error: 'Expired' };
  }
  await noteMessage(botToken, callbackQuery, `ℹ️ <b>Already ${existing.status}</b>`);
  return { success: false, error: `Already ${existing.status}` };
}

export async function handleRpcConnectionApprove(
  botToken: string,
  callbackQuery: TelegramCallbackQuery,
  connectionId: string
): Promise<HandlerResult> {
  const approved = await approveRpcConnection(connectionId, RPC_CONNECTION_TTL_MS);
  if (!approved) {
    return explainFailure(botToken, callbackQuery, connectionId);
  }

  const expiresAt = approved.expiresAt?.toISOString() ?? 'unknown';
  await noteMessage(
    botToken,
    callbackQuery,
    `✅ <b>Approved</b>\nExpires: ${escapeHtml(expiresAt)}`
  );
  return { success: true };
}

export async function handleRpcConnectionReject(
  botToken: string,
  callbackQuery: TelegramCallbackQuery,
  connectionId: string
): Promise<HandlerResult> {
  const rejected = await rejectPendingRpcConnection(connectionId);
  if (!rejected) {
    return explainFailure(botToken, callbackQuery, connectionId);
  }
  await noteMessage(botToken, callbackQuery, '❌ <b>Rejected</b>');
  return { success: true };
}
