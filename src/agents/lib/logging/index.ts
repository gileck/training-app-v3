/**
 * Agent execution logging system
 *
 * This module provides comprehensive logging for AI agent executions,
 * creating human-readable Markdown logs for each issue.
 *
 * S3 Logging:
 * When AWS_S3_LOG_BUCKET is set, logs are written to S3 instead of the local
 * filesystem. This enables unified logging from all sources (local agents,
 * GitHub Actions, Vercel webhooks). When a workflow completes, the S3 log
 * is synced to the repository and the S3 file is deleted.
 */

export * from './types';
export * from './context';
export * from './writer';
export * from './logger';
export * from './cost-summary';

// S3 logging support
export * from './s3-writer';
export * from './s3-sync';
