import { CheckCircle2, Loader2, RotateCcw, ShieldCheck, Square, XCircle, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import type { RpcConnectionView, TestRpcResponse } from '@/apis/template/rpc-connections/types';
import { formatRemaining, useNow } from '../utils';
import { useTestRpc } from '../hooks';
import { MetaList } from './MetaList';

interface Props {
  connection: RpcConnectionView;
  onStop: () => void;
  onRestart: () => void;
  isStopping: boolean;
  isRestarting: boolean;
}

export function ApprovedState({
  connection,
  onStop,
  onRestart,
  isStopping,
  isRestarting,
}: Props) {
  const now = useNow();
  const expiresAtMs = connection.expiresAt ? new Date(connection.expiresAt).getTime() : 0;
  const remaining = expiresAtMs - now;
  const testMutation = useTestRpc();
  const busy = isStopping || isRestarting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-success">
          <ShieldCheck className="h-5 w-5" />
          Connected
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          RPC calls are permitted. Connection expires in{' '}
          <span className="font-mono">{formatRemaining(remaining)}</span>.
        </p>
        <MetaList connection={connection} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onStop} disabled={busy} className="min-h-11">
            {isStopping ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Stopping…</>
            ) : (
              <><Square className="mr-2 h-4 w-4" />Stop</>
            )}
          </Button>
          <Button onClick={onRestart} disabled={busy} className="min-h-11">
            {isRestarting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Restarting…</>
            ) : (
              <><RotateCcw className="mr-2 h-4 w-4" />Restart</>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={() => testMutation.mutate(undefined)}
            disabled={busy || testMutation.isPending}
            className="min-h-11"
          >
            {testMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Testing…</>
            ) : (
              <><Zap className="mr-2 h-4 w-4" />Test</>
            )}
          </Button>
        </div>
        <TestResult
          isPending={testMutation.isPending}
          error={testMutation.error}
          data={testMutation.data ?? null}
        />
      </CardContent>
    </Card>
  );
}

interface TestResultProps {
  isPending: boolean;
  error: Error | null;
  data: TestRpcResponse | null;
}

function TestResult({ isPending, error, data }: TestResultProps) {
  if (isPending) return null;

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="break-words">
          <div className="font-medium">Test failed</div>
          <div className="font-mono">{error.message}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (!data.ok) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="break-words">
          <div className="font-medium">Test failed</div>
          <div className="font-mono">{data.error ?? 'Unknown error'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="break-words">
        <div className="font-medium">Test succeeded</div>
        <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5 font-mono">
          <dt>echo:</dt>
          <dd>{data.echo}</dd>
          {data.handlerTimestamp && (
            <>
              <dt>at:</dt>
              <dd>{data.handlerTimestamp}</dd>
            </>
          )}
          {data.handlerHost && (
            <>
              <dt>host:</dt>
              <dd>{data.handlerHost}</dd>
            </>
          )}
          {typeof data.durationMs === 'number' && (
            <>
              <dt>took:</dt>
              <dd>{data.durationMs}ms</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
