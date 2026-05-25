import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import type { RpcConnectionView } from '@/apis/template/rpc-connections/types';
import { formatRemaining, useNow } from '../utils';
import { MetaList } from './MetaList';

interface Props {
  connection: RpcConnectionView;
  onCancel: () => void;
  isCancelling: boolean;
}

export function PendingState({ connection, onCancel, isCancelling }: Props) {
  const now = useNow();
  const remaining = new Date(connection.pendingExpiresAt).getTime() - now;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Waiting for admin approval
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          A Telegram approval request was sent to the admin. RPC calls will
          remain blocked until approval. Auto-expires in{' '}
          <span className="font-mono">{formatRemaining(remaining)}</span>.
        </p>
        <MetaList connection={connection} />
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isCancelling}
          className="self-start min-h-11"
        >
          {isCancelling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cancelling…
            </>
          ) : (
            'Cancel request'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
