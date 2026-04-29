import type { ObjectId } from 'mongodb';

export type LoginApprovalStatus = 'pending' | 'approved';
export type LoginApprovalMethod = 'telegram' | 'email';

export interface LoginApproval {
  _id: ObjectId;
  userId: ObjectId;
  username: string;
  method: LoginApprovalMethod;
  browserToken: string;
  externalApprovalToken: string;
  status: LoginApprovalStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  approvedVia?: LoginApprovalMethod;
}

export type LoginApprovalCreate = Omit<LoginApproval, '_id' | 'approvedAt' | 'approvedBy' | 'approvedVia'>;
