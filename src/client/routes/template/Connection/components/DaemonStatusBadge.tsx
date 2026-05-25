import { Loader2 } from 'lucide-react';
import { useDaemonStatus } from '@/client/features/template/rpc-connection';

export function DaemonStatusBadge() {
  const { data, isLoading } = useDaemonStatus();

  if (isLoading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking daemon…
      </div>
    );
  }

  const alive = data?.alive ?? false;
  const lastSeen = data?.lastHeartbeat ? new Date(data.lastHeartbeat) : null;
  const ageStr = lastSeen ? formatAge(Date.now() - lastSeen.getTime()) : null;

  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
        alive
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-destructive/30 bg-destructive/10 text-destructive'
      }`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${alive ? 'bg-success' : 'bg-destructive'}`} />
      <span className="font-medium">
        Daemon {alive ? 'online' : 'offline'}
      </span>
      {lastSeen && (
        <span className="text-muted-foreground">
          · last heartbeat {ageStr} ago
          {data?.hostname ? ` · ${data.hostname}` : ''}
        </span>
      )}
      {!lastSeen && !alive && (
        <span className="text-muted-foreground">
          · never seen — run <code className="font-mono">yarn daemon</code>
        </span>
      )}
    </div>
  );
}

function formatAge(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}
