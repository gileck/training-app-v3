import { randomBytes } from 'crypto';
import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../../../connection';
import type { LoginApproval, LoginApprovalCreate } from './types';

export const LOGIN_APPROVAL_TTL_MS = 10 * 60 * 1000;

const getLoginApprovalsCollection = async (): Promise<Collection<LoginApproval>> => {
  const db = await getDb();
  return db.collection<LoginApproval>('login_approvals');
};

function toObjectId(id: ObjectId | string): ObjectId | null {
  if (id instanceof ObjectId) {
    return id;
  }

  if (!ObjectId.isValid(id)) {
    return null;
  }

  return new ObjectId(id);
}

export const createLoginApproval = async (params: {
  userId: ObjectId | string;
  username: string;
  method: LoginApproval['method'];
}): Promise<LoginApproval> => {
  const collection = await getLoginApprovalsCollection();
  const now = new Date();
  const userId = toObjectId(params.userId);

  if (!userId) {
    throw new Error('Invalid user ID for login approval');
  }

  const document: LoginApprovalCreate = {
    userId,
    username: params.username,
    method: params.method,
    browserToken: randomBytes(32).toString('hex'),
    externalApprovalToken: randomBytes(32).toString('hex'),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + LOGIN_APPROVAL_TTL_MS),
  };

  const result = await collection.insertOne(document as LoginApproval);

  if (!result.insertedId) {
    throw new Error('Failed to create login approval');
  }

  return {
    ...document,
    _id: result.insertedId,
  };
};

export const findLoginApprovalById = async (
  approvalId: ObjectId | string
): Promise<LoginApproval | null> => {
  const collection = await getLoginApprovalsCollection();
  const objectId = toObjectId(approvalId);

  if (!objectId) {
    return null;
  }

  return collection.findOne({ _id: objectId });
};

export const findLoginApprovalByIdAndToken = async (
  approvalId: ObjectId | string,
  browserToken: string
): Promise<LoginApproval | null> => {
  const collection = await getLoginApprovalsCollection();
  const objectId = toObjectId(approvalId);

  if (!objectId) {
    return null;
  }

  return collection.findOne({
    _id: objectId,
    browserToken,
  });
};

export const approveLoginApproval = async (
  approvalId: ObjectId | string,
  approvedVia: LoginApproval['method'],
  approvedBy?: string
): Promise<LoginApproval | null> => {
  const collection = await getLoginApprovalsCollection();
  const objectId = toObjectId(approvalId);

  if (!objectId) {
    return null;
  }

  const now = new Date();

  const result = await collection.findOneAndUpdate(
    {
      _id: objectId,
      status: 'pending',
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: 'approved',
        approvedAt: now,
        approvedBy,
        approvedVia,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  );

  return result || null;
};

export const approveLoginApprovalByExternalToken = async (
  approvalId: ObjectId | string,
  externalApprovalToken: string,
  approvedVia: LoginApproval['method'],
  approvedBy?: string
): Promise<LoginApproval | null> => {
  const collection = await getLoginApprovalsCollection();
  const objectId = toObjectId(approvalId);

  if (!objectId) {
    return null;
  }

  const now = new Date();

  const result = await collection.findOneAndUpdate(
    {
      _id: objectId,
      externalApprovalToken,
      status: 'pending',
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: 'approved',
        approvedAt: now,
        approvedBy,
        approvedVia,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  );

  return result || null;
};

export const deleteLoginApproval = async (
  approvalId: ObjectId | string
): Promise<boolean> => {
  const collection = await getLoginApprovalsCollection();
  const objectId = toObjectId(approvalId);

  if (!objectId) {
    return false;
  }

  const result = await collection.deleteOne({ _id: objectId });
  return result.deletedCount === 1;
};
