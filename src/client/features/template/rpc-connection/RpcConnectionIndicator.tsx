/**
 * Compact admin-only RPC status pill. Drop into any layout slot — the
 * component self-hides for non-admin users, so projects can render it
 * unconditionally and let the admin gate decide visibility.
 */

import { useEffect, useState } from 'react';
import { Loader2, Plug, RotateCcw, Square, ExternalLink } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/client/components/template/ui/dialog';
import { useIsAdmin, useAuthMode } from '@/client/features/template/auth/store';
import { useRouter } from '@/client/features/template/router';
import {
  useConnectRpc,
  useCurrentRpcConnection,
  useStopRpc,
} from './hooks';
import { RpcExpiryWarningDialog } from './RpcExpiryWarningDialog';
import type { RpcConnectionView } from '@/apis/template/rpc-connections/types';

const CONNECTION_PAGE_PATH = '/admin/rpc-connection';

interface IndicatorVisual {
  dotClass: string;
  label: string;
  pulse: boolean;
}

function visualFor(connection: RpcConnectionView | null): IndicatorVisual {
  if (!connection) return { dotClass: 'bg-muted-foreground/40', label: 'Offline', pulse: false };
  if (connection.status === 'pending')
    return { dotClass: 'bg-warning', label: 'Pending', pulse: true };
  if (connection.status === 'approved')
    return { dotClass: 'bg-success', label: 'Online', pulse: false };
  return { dotClass: 'bg-muted-foreground/40', label: 'Offline', pulse: false };
}

export function RpcConnectionIndicator() {
  const isAdmin = useIsAdmin();
  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog open state
  const [open, setOpen] = useState(false);

  const { data: connection } = useCurrentRpcConnection();
  if (!isAdmin) return null;

  const visual = visualFor(connection ?? null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`RPC connection: ${visual.label}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted min-h-9"
      >
        <span className="relative inline-flex h-2 w-2">
          {visual.pulse && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${visual.dotClass}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${visual.dotClass}`} />
        </span>
        <span>RPC</span>
      </button>

      <RpcConnectionDialog
        open={open}
        onOpenChange={setOpen}
        connection={connection ?? null}
      />
      <RpcExpiryWarningDialog />
    </>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: RpcConnectionView | null;
}

function RpcConnectionDialog({ open, onOpenChange, connection }: DialogProps) {
  const router = useRouter();
  const connectMutation = useConnectRpc();
  const stopMutation = useStopRpc();

  const onConnect = () => connectMutation.mutate();
  const onStop = () => stopMutation.mutate();
  const onRestart = () =>
    stopMutation.mutate(undefined, { onSuccess: () => connectMutation.mutate() });
  const onOpenPage = () => {
    onOpenChange(false);
    router.navigate(CONNECTION_PAGE_PATH);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>RPC Connection</DialogTitle>
          <DialogDescription>
            Manage your admin-approved RPC session.
          </DialogDescription>
        </DialogHeader>

        <DialogBody
          connection={connection}
          onConnect={onConnect}
          onStop={onStop}
          onRestart={onRestart}
          isConnecting={connectMutation.isPending}
          isStopping={stopMutation.isPending}
        />

        <button
          type="button"
          onClick={onOpenPage}
          className="mt-2 inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
        >
          Open full connection page
          <ExternalLink className="h-3 w-3" />
        </button>
      </DialogContent>
    </Dialog>
  );
}

interface BodyProps {
  connection: RpcConnectionView | null;
  onConnect: () => void;
  onStop: () => void;
  onRestart: () => void;
  isConnecting: boolean;
  isStopping: boolean;
}

function DialogBody({
  connection,
  onConnect,
  onStop,
  onRestart,
  isConnecting,
  isStopping,
}: BodyProps) {
  const passkeyMode = useAuthMode() === 'passkey';
  if (!connection) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {passkeyMode
            ? 'Not connected. Click Connect and verify this device with your passkey.'
            : 'Not connected. Click Connect to send an approval request to the admin.'}
        </p>
        <Button onClick={onConnect} disabled={isConnecting} className="self-start min-h-11">
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {passkeyMode ? 'Verifying device…' : 'Sending request…'}
            </>
          ) : (
            <><Plug className="mr-2 h-4 w-4" />Connect</>
          )}
        </Button>
      </div>
    );
  }

  if (connection.status === 'pending') {
    return (
      <div className="flex flex-col gap-3">
        <PendingTimer pendingExpiresAt={connection.pendingExpiresAt} />
        <Button
          variant="outline"
          onClick={onStop}
          disabled={isStopping}
          className="self-start min-h-11"
        >
          {isStopping ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling…</>
          ) : (
            'Cancel request'
          )}
        </Button>
      </div>
    );
  }

  if (connection.status === 'approved') {
    return (
      <div className="flex flex-col gap-3">
        <ApprovedTimer expiresAt={connection.expiresAt} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onStop}
            disabled={isStopping || isConnecting}
            className="min-h-11"
          >
            {isStopping ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Stopping…</>
            ) : (
              <><Square className="mr-2 h-4 w-4" />Stop</>
            )}
          </Button>
          <Button
            onClick={onRestart}
            disabled={isStopping || isConnecting}
            className="min-h-11"
          >
            {isConnecting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Restarting…</>
            ) : (
              <><RotateCcw className="mr-2 h-4 w-4" />Restart</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function PendingTimer({ pendingExpiresAt }: { pendingExpiresAt: string }) {
  const remaining = useRemaining(pendingExpiresAt);
  return (
    <p className="text-sm text-muted-foreground">
      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
      Waiting for admin approval — auto-expires in{' '}
      <span className="font-mono text-foreground">{remaining}</span>.
    </p>
  );
}

function ApprovedTimer({ expiresAt }: { expiresAt?: string }) {
  const remaining = useRemaining(expiresAt);
  return (
    <p className="text-sm text-muted-foreground">
      Connected. Expires in <span className="font-mono text-foreground">{remaining}</span>.
    </p>
  );
}

function useRemaining(deadlineIso: string | undefined): string {
  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral render-tick clock
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!deadlineIso) return '—';
  const ms = Math.max(0, new Date(deadlineIso).getTime() - now);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s.toString().padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}
