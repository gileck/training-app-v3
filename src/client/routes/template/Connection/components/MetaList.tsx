import type { RpcConnectionView } from '@/apis/template/rpc-connections/types';
import { formatTs } from '../utils';

export function MetaList({ connection }: { connection: RpcConnectionView }) {
  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <dt className="font-medium">Requested:</dt>
      <dd className="break-all">{formatTs(connection.requestedAt)}</dd>
      {connection.approvedAt && (
        <>
          <dt className="font-medium">Approved:</dt>
          <dd className="break-all">{formatTs(connection.approvedAt)}</dd>
        </>
      )}
      <dt className="font-medium">Device:</dt>
      <dd className="break-words">{connection.userAgent || 'unknown'}</dd>
      <dt className="font-medium">IP:</dt>
      <dd className="break-words">{connection.ip || 'unknown'}</dd>
    </dl>
  );
}
