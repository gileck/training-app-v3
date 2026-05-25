export const RPC_CONNECTION_REQUIRED_CODE = 'RPC_CONNECTION_REQUIRED';

export class RpcConnectionRequiredError extends Error {
  readonly code = RPC_CONNECTION_REQUIRED_CODE;

  constructor(message = 'RPC connection required. Open the Connection page to reconnect.') {
    super(message);
    this.name = 'RpcConnectionRequiredError';
  }
}

export function isRpcConnectionRequiredError(
  err: unknown
): err is RpcConnectionRequiredError {
  return (
    err instanceof RpcConnectionRequiredError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === RPC_CONNECTION_REQUIRED_CODE)
  );
}
