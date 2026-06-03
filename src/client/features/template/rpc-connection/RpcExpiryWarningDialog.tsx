/**
 * Renders a one-time warning dialog when an approved RPC session is within
 * WARN_BEFORE_MS of its expiry. Self-hides once the user dismisses or
 * reconnects; if a fresh Connect issues a new row with a different id, the
 * warning is eligible to fire again later in that new session.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/template/ui/dialog';
import {
  useConnectRpc,
  useCurrentRpcConnection,
  useStopRpc,
} from './hooks';
import { useAuthMode } from '@/client/features/template/auth/store';

const WARN_BEFORE_MS = 5 * 60 * 1000;

export function RpcExpiryWarningDialog() {
  const { data: connection } = useCurrentRpcConnection();
  const stopMutation = useStopRpc();
  const connectMutation = useConnectRpc();
  const passkeyMode = useAuthMode() === 'passkey';

  // eslint-disable-next-line state-management/prefer-state-architecture -- per-connection ack flag, paired with the dialog open state
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral render-tick clock for the in-dialog countdown
  const [now, setNow] = useState(() => Date.now());

  const isApproved = connection?.status === 'approved' && !!connection.expiresAt;
  useEffect(() => {
    if (!isApproved) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isApproved]);

  if (!connection || !isApproved || !connection.expiresAt) return null;

  const msLeft = new Date(connection.expiresAt).getTime() - now;
  const inWarnWindow = msLeft > 0 && msLeft <= WARN_BEFORE_MS;
  const open = inWarnWindow && dismissedId !== connection.id;

  const handleOpenChange = (next: boolean) => {
    if (!next) setDismissedId(connection.id);
  };

  const onReconnect = () => {
    stopMutation.mutate(undefined, {
      onSuccess: () => {
        connectMutation.mutate();
        setDismissedId(connection.id);
      },
    });
  };

  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isBusy = stopMutation.isPending || connectMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            RPC session expiring soon
          </DialogTitle>
          <DialogDescription>
            Your RPC session expires in{' '}
            <span className="font-mono text-foreground">
              {minutes}m {seconds.toString().padStart(2, '0')}s
            </span>
            . Reconnect now to keep RPC available —{' '}
            {passkeyMode ? 'verify your device again' : 'admin approval is required again'}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => setDismissedId(connection.id)}
            className="min-h-11"
          >
            Dismiss
          </Button>
          <Button onClick={onReconnect} disabled={isBusy} className="min-h-11">
            {isBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reconnecting…
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reconnect
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
