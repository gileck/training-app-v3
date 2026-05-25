import { Loader2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/client/components/template/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/client/components/template/ui/tabs';
import { useConnectRpc, useCurrentRpcConnection, useStopRpc } from './hooks';
import { IdleState } from './components/IdleState';
import { PendingState } from './components/PendingState';
import { ApprovedState } from './components/ApprovedState';
import { HistoryTab } from './components/HistoryTab';
import { DaemonStatusBadge } from './components/DaemonStatusBadge';

export function Connection() {
  const currentQuery = useCurrentRpcConnection();
  const connectMutation = useConnectRpc();
  const stopMutation = useStopRpc();

  const connection = currentQuery.data ?? null;
  const onStop = () => stopMutation.mutate();
  const onConnect = () => connectMutation.mutate();
  const onRestart = () =>
    stopMutation.mutate(undefined, { onSuccess: () => connectMutation.mutate() });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-20 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">RPC Connection</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open an admin-approved session to run RPC-backed actions. Sessions
          expire automatically after the configured TTL.
        </p>
      </div>

      <DaemonStatusBadge />

      <Tabs defaultValue="current">
        <TabsList className="mb-4">
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          {currentQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : currentQuery.error ? (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Failed to load connection</AlertTitle>
              <AlertDescription>
                {currentQuery.error instanceof Error
                  ? currentQuery.error.message
                  : 'Unknown error'}
              </AlertDescription>
            </Alert>
          ) : !connection ? (
            <IdleState onConnect={onConnect} isPending={connectMutation.isPending} />
          ) : connection.status === 'pending' ? (
            <PendingState
              connection={connection}
              onCancel={onStop}
              isCancelling={stopMutation.isPending}
            />
          ) : connection.status === 'approved' ? (
            <ApprovedState
              connection={connection}
              onStop={onStop}
              onRestart={onRestart}
              isStopping={stopMutation.isPending}
              isRestarting={connectMutation.isPending}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
