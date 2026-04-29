import type { PendingLoginApproval } from '@/apis/template/login-approvals/types';

const STORAGE_KEY = 'pending-login-approval';

export function savePendingLoginApproval(
  approval: PendingLoginApproval
) {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(approval));
}

export function readPendingLoginApproval():
  | PendingLoginApproval
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = sessionStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PendingLoginApproval;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearPendingLoginApproval() {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(STORAGE_KEY);
}
