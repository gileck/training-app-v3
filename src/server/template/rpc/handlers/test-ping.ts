/**
 * Minimal RPC handler used by the Connection page Test button to verify
 * end-to-end RPC connectivity (Vercel → MongoDB → daemon → response).
 */
export default async function handleTestPing(args: Record<string, unknown>) {
  const message = typeof args.message === 'string' ? args.message : 'ping';
  return {
    echo: message,
    handlerTimestamp: new Date().toISOString(),
    handlerHost: process.env.HOSTNAME ?? null,
  };
}
