/**
 * Admin Sessions Page
 *
 * Admin-only dashboard for user-session tracking.
 * Shows global counts (total users, visitors today/week/month, sessions
 * total/today/week) plus a per-user table with last visited and total
 * session count. Sessions are recorded on explicit login, register, and
 * every successful auth/me cookie validation (auto-login).
 */

import { Loader2, AlertCircle, Activity } from 'lucide-react';
import { Card, CardContent } from '@/client/components/template/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/client/components/template/ui/alert';
import { useSessionStats, useSessionUsers } from './hooks';
import type {
  SessionStats,
  SessionUserRow,
} from '@/apis/template/admin-sessions/types';

export function AdminSessions() {
  const stats = useSessionStats();
  const usersList = useSessionUsers();

  const isLoading = stats.isLoading || usersList.isLoading;
  const error = stats.error || usersList.error;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-20 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Login activity and user visit tracking. Auto-logins are counted on
          every successful cookie validation (app boot).
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load session data</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && stats.data && (
        <StatsGrid stats={stats.data} />
      )}

      {!isLoading && !error && usersList.data && (
        <UsersTable users={usersList.data} />
      )}
    </div>
  );
}

interface StatsGridProps {
  stats: SessionStats;
}

function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Users
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Visited Today" value={stats.visitorsToday} />
        <StatCard label="Visited This Week" value={stats.visitorsThisWeek} />
        <StatCard label="Visited This Month" value={stats.visitorsThisMonth} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Sessions
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total Sessions" value={stats.sessionsTotal} />
        <StatCard label="Sessions Today" value={stats.sessionsToday} />
        <StatCard label="Sessions This Week" value={stats.sessionsThisWeek} />
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-2xl font-bold text-foreground">{value.toLocaleString()}</span>
      </CardContent>
    </Card>
  );
}

interface UsersTableProps {
  users: SessionUserRow[];
}

function UsersTable({ users }: UsersTableProps) {
  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Activity className="h-10 w-10 text-muted-foreground" />
          <p className="text-base font-medium text-foreground">No users yet</p>
          <p className="text-sm text-muted-foreground">
            Once anyone signs up or logs in, they will show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Per User
      </h2>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Last Visited</th>
                  <th className="px-4 py-3 text-right font-medium">Total Sessions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.userId}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium text-foreground break-words">
                      {user.username}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatLastSeen(user.lastSeenAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                      {user.sessionsTotal.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatLastSeen(iso: string | undefined): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
