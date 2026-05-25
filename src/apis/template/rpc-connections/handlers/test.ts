import { callRemote } from '@/server/template/rpc';
import { isRpcConnectionRequiredError } from '@/server/template/rpc/errors';
import type { TestRpcRequest, TestRpcResponse } from '../types';

const HANDLER_PATH = 'src/server/template/rpc/handlers/test-ping';

interface PingResult {
  echo: string;
  handlerTimestamp: string;
  handlerHost: string | null;
}

export const test = async (
  request: TestRpcRequest
): Promise<TestRpcResponse> => {
  try {
    const { data, durationMs } = await callRemote<PingResult>(
      HANDLER_PATH,
      { message: request.message ?? 'ping' },
      { skipCache: true, timeoutMs: 10_000, pendingPickupTimeoutMs: 8_000 }
    );
    return {
      ok: true,
      echo: data.echo,
      handlerTimestamp: data.handlerTimestamp,
      handlerHost: data.handlerHost,
      durationMs,
    };
  } catch (err) {
    if (isRpcConnectionRequiredError(err)) throw err;
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Test RPC call failed',
    };
  }
};
