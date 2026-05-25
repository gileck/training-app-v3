import { Loader2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';
import { Card, CardContent } from '@/client/components/template/ui/card';
import type { RpcConnectionView } from '@/apis/template/rpc-connections/types';
import { useRpcConnectionHistory } from '../hooks';
import { formatTs } from '../utils';

const STATUS_BADGE: Record<RpcConnectionView['status'], string> = {
  pending: 'bg-warning/15 text-warning border-warning/30',
  approved: 'bg-success/15 text-success border-success/30',
  revoked: 'bg-muted text-muted-foreground border-border',
  expired: 'bg-muted text-muted-foreground border-border',
};

const REASON_LABEL: Record<NonNullable<RpcConnectionView['endedReason']>, string> = {
  ttl: 'TTL reached',
  user_stop: 'User stopped',
  admin_reject: 'Admin rejected',
  pending_timeout: 'No admin response',
};

export function HistoryTab() {
  const { data, isLoading, error } = useRpcConnectionHistory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Failed to load history</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No connections yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Requested</th>
                <th className="px-3 py-2 font-medium">Approved</th>
                <th className="px-3 py-2 font-medium">Ended</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ row }: { row: RpcConnectionView }) {
  const duration = computeDuration(row);
  const deviceShort = shortDevice(row.userAgent);
  return (
    <tr className="border-b border-border last:border-b-0 align-top">
      <td className="px-3 py-2">
        <span
          className={`inline-block rounded border px-2 py-0.5 text-xs ${STATUS_BADGE[row.status]}`}
        >
          {row.status}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-foreground break-words">
        {row.requestedByUsername ?? row.userId}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{formatTs(row.requestedAt)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {row.approvedAt ? formatTs(row.approvedAt) : '—'}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {row.endedAt ? formatTs(row.endedAt) : '—'}
      </td>
      <td className="px-3 py-2 text-xs font-mono">{duration ?? '—'}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {row.endedReason ? REASON_LABEL[row.endedReason] : '—'}
      </td>
      <td
        className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate"
        title={row.userAgent || 'unknown'}
      >
        {deviceShort}
      </td>
      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{row.ip || '—'}</td>
    </tr>
  );
}

function shortDevice(ua: string): string {
  if (!ua) return 'unknown';
  // Best-effort: pull out the OS hint between the first parens, plus the
  // browser keyword. Falls back to truncated raw UA. Hover shows full string.
  const osMatch = ua.match(/\(([^)]+)\)/);
  const os = osMatch?.[1].split(';')[0]?.trim() ?? '';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : '';
  if (os && browser) return `${browser} · ${os}`;
  if (browser) return browser;
  if (os) return os;
  return ua.slice(0, 40);
}

function computeDuration(row: RpcConnectionView): string | null {
  if (!row.approvedAt) return null;
  const start = new Date(row.approvedAt).getTime();
  const end = row.endedAt ? new Date(row.endedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
