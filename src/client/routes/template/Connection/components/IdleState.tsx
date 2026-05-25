import { Loader2, Plug } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';

interface Props {
  onConnect: () => void;
  isPending: boolean;
}

export function IdleState({ onConnect, isPending }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          Not connected
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Click Connect to send an approval request to the admin via
          Telegram. RPC calls will fail until the request is approved.
        </p>
        <Button onClick={onConnect} disabled={isPending} className="self-start min-h-11">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending request…
            </>
          ) : (
            <>
              <Plug className="mr-2 h-4 w-4" />
              Connect
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
