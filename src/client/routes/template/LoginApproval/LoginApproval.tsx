import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Loader2, MessageSquare, ShieldCheck, AlertTriangle, Mail } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, currentUserQueryKey, useUser } from '@/client/features';
import { useRouter } from '@/client/features';
import { apiCompleteLoginApproval } from '@/apis/template/login-approvals/client';
import {
  clearPendingLoginApproval,
  readPendingLoginApproval,
} from '@/client/features/template/auth/login-approval-storage';
import type { TwoFactorMethod } from '@/apis/template/auth/types';

type ApprovalScreenState = 'checking' | 'pending' | 'expired' | 'invalid';

export const LoginApproval = () => {
  const { queryParams, navigate } = useRouter();
  const user = useUser();
  const setValidatedUser = useAuthStore((state) => state.setValidatedUser);
  const queryClient = useQueryClient();
  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for waiting-page status
  const [screenState, setScreenState] = useState<ApprovalScreenState>('checking');
  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral countdown display data for the current waiting page instance
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  // eslint-disable-next-line state-management/prefer-state-architecture -- transient retry message for temporary approval polling failures
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pollInFlightRef = useRef(false);

  const storedApproval = useMemo(() => {
    const approvalId = queryParams.id;
    const pendingApproval = readPendingLoginApproval();

    if (!approvalId || !pendingApproval || pendingApproval.approvalId !== approvalId) {
      return null;
    }

    return pendingApproval;
  }, [queryParams.id]);

  useEffect(() => {
    if (user && storedApproval?.redirectPath) {
      navigate(storedApproval.redirectPath, { replace: true });
    }
  }, [navigate, storedApproval?.redirectPath, user]);

  useEffect(() => {
    if (!storedApproval) {
      clearPendingLoginApproval();
      setScreenState('invalid');
      return;
    }

    setExpiresAt(storedApproval.expiresAt);

    let cancelled = false;
    let intervalId: number | null = null;

    const pollApproval = async () => {
      if (pollInFlightRef.current) {
        return;
      }

      pollInFlightRef.current = true;

      try {
        const response = await apiCompleteLoginApproval({
          approvalId: storedApproval.approvalId,
          approvalToken: storedApproval.approvalToken,
        });

        if (cancelled) {
          return;
        }

        const data = response.data;
        setExpiresAt(data.expiresAt || storedApproval.expiresAt);

        if (data.status === 'authenticated' && data.user) {
          clearPendingLoginApproval();
          queryClient.setQueryData(currentUserQueryKey, { user: data.user });
          setValidatedUser(data.user);
          navigate(storedApproval.redirectPath || '/', { replace: true });
          return;
        }

        if (data.status === 'pending') {
          setScreenState('pending');
          setStatusMessage(null);
          return;
        }

        clearPendingLoginApproval();
        setScreenState(data.status === 'expired' ? 'expired' : 'invalid');
      } catch (error) {
        if (!cancelled) {
          setScreenState('pending');
          setStatusMessage(error instanceof Error ? error.message : 'Temporary connection issue. Retrying...');
        }
      } finally {
        pollInFlightRef.current = false;
      }
    };

    void pollApproval();
    intervalId = window.setInterval(() => {
      void pollApproval();
    }, 2000);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [navigate, queryClient, setValidatedUser, storedApproval]);

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const method = storedApproval?.approvalMethod || 'email';
  const methodCopy = getApprovalCopy(method, storedApproval?.approvalHint);

  if (screenState === 'invalid') {
    return (
      <ApprovalLayout
        icon={<AlertTriangle className="h-8 w-8 text-primary-foreground" />}
        title="Login request not found"
        description="This approval page is missing its active login request. Start the sign-in flow again from the app."
        footerAction={() => navigate('/', { replace: true })}
        footerLabel="Back to app"
      />
    );
  }

  if (screenState === 'expired') {
    return (
      <ApprovalLayout
        icon={<AlertTriangle className="h-8 w-8 text-primary-foreground" />}
        title="Login request expired"
        description={`The ${method === 'telegram' ? 'Telegram' : 'email'} approval window expired before it was confirmed. Start the sign-in flow again.`}
        footerAction={() => navigate('/', { replace: true })}
        footerLabel="Try again"
      />
    );
  }

  return (
    <ApprovalLayout
      icon={screenState === 'checking'
        ? <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
        : <ShieldCheck className="h-8 w-8 text-primary-foreground" />}
      title={methodCopy.title}
      description={methodCopy.description}
      footer={
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm text-muted-foreground">
            {method === 'telegram' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {methodCopy.badge}
          </div>
          {expiresLabel && (
            <p className="text-xs text-muted-foreground">
              Request expires around {expiresLabel}.
            </p>
          )}
          {statusMessage && (
            <p className="text-xs text-muted-foreground">
              Retrying after a connection issue: {statusMessage}
            </p>
          )}
        </div>
      }
    />
  );
};

function getApprovalCopy(method: TwoFactorMethod, approvalHint?: string) {
  if (method === 'telegram') {
    return {
      title: 'Approve sign-in in Telegram',
      description: 'A Telegram message was sent to your account. Approve it there and this page will continue automatically.',
      badge: 'Waiting for Telegram approval',
    };
  }

  return {
    title: 'Approve sign-in from your email',
    description: approvalHint
      ? `We sent an approval link to ${approvalHint}. Open it and this page will continue automatically.`
      : 'We sent an approval link to your email address. Open it and this page will continue automatically.',
    badge: 'Waiting for email approval',
  };
}

function ApprovalLayout(props: {
  icon: ReactNode;
  title: string;
  description: string;
  footer?: ReactNode;
  footerLabel?: string;
  footerAction?: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.18),_transparent_45%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.65))] px-4 py-8">
      <div className="w-full max-w-md rounded-[28px] border border-border/60 bg-background/95 p-8 shadow-2xl shadow-primary/10 backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
          {props.icon}
        </div>
        <div className="mt-6 space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-foreground">{props.title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{props.description}</p>
        </div>
        <div className="mt-8">
          {props.footer}
          {props.footerAction && props.footerLabel && (
            <button
              type="button"
              onClick={props.footerAction}
              className="mt-6 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              {props.footerLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
