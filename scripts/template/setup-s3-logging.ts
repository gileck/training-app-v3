#!/usr/bin/env npx tsx
/**
 * Setup S3 Bucket for Agent Logging
 *
 * Creates an S3 bucket (if needed) and configures it for agent workflow logging.
 * Automatically updates .env.local, Vercel, and GitHub Actions.
 *
 * Usage:
 *   yarn setup-s3-logging [bucket-name]
 *
 * If bucket-name is not provided, uses the default bucket from sdk.ts
 *
 * Prerequisites:
 *   - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set
 *   - IAM user must have s3:CreateBucket permission (or bucket must exist)
 *   - Vercel CLI linked (for Vercel sync)
 *   - GitHub CLI authenticated (for GitHub Actions)
 */

// Load environment variables from .env.local
import '../../src/agents/shared/loadEnv';

import {
    S3Client,
    CreateBucketCommand,
    HeadBucketCommand,
    PutBucketLifecycleConfigurationCommand,
    PutPublicAccessBlockCommand,
    type BucketLocationConstraint,
} from '@aws-sdk/client-s3';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const DEFAULT_REGION = 'us-east-1';
const LOG_PREFIX = 'agent-logs/';
const ORPHAN_CLEANUP_DAYS = 30; // Delete orphaned logs after 30 days
const ENV_VAR_NAME = 'AWS_S3_LOG_BUCKET';

/**
 * Add or update env var in .env.local
 */
function updateEnvLocal(bucketName: string): boolean {
    const envPath = resolve(process.cwd(), '.env.local');

    try {
        let content = '';
        if (existsSync(envPath)) {
            content = readFileSync(envPath, 'utf-8');

            // Check if already set
            const regex = new RegExp(`^${ENV_VAR_NAME}=.*$`, 'm');
            if (regex.test(content)) {
                // Update existing value
                content = content.replace(regex, `${ENV_VAR_NAME}=${bucketName}`);
                console.log('✅ Updated AWS_S3_LOG_BUCKET in .env.local');
            } else {
                // Append new value
                content = content.trimEnd() + `\n\n# S3 Logging (added by setup-s3-logging)\n${ENV_VAR_NAME}=${bucketName}\n`;
                console.log('✅ Added AWS_S3_LOG_BUCKET to .env.local');
            }
        } else {
            // Create new file
            content = `# S3 Logging\n${ENV_VAR_NAME}=${bucketName}\n`;
            console.log('✅ Created .env.local with AWS_S3_LOG_BUCKET');
        }

        writeFileSync(envPath, content);
        return true;
    } catch (error) {
        console.error('❌ Failed to update .env.local:', error instanceof Error ? error.message : error);
        return false;
    }
}

/**
 * Set S3 bucket env var in Vercel using vercel-cli
 */
function syncToVercel(bucketName: string): boolean {
    try {
        console.log(`   Setting ${ENV_VAR_NAME}=${bucketName} in Vercel...`);
        execSync(`yarn vercel-cli env:set --name ${ENV_VAR_NAME} --value "${bucketName}"`, { stdio: 'inherit' });
        return true;
    } catch (error) {
        console.error('❌ Failed to set env var in Vercel');
        console.error(`   You can manually run: yarn vercel-cli env:set --name ${ENV_VAR_NAME} --value "${bucketName}"`);
        return false;
    }
}

/**
 * Add env var to GitHub Actions using gh CLI
 */
function addToGitHubActions(bucketName: string): boolean {
    try {
        // Check if gh CLI is available
        execSync('gh --version', { stdio: 'ignore' });
    } catch {
        console.warn('⚠️  GitHub CLI (gh) not found, skipping GitHub Actions setup');
        console.warn('   Install gh CLI and run: gh variable set AWS_S3_LOG_BUCKET --body "' + bucketName + '"');
        return false;
    }

    try {
        // Add as repository variable (not secret - bucket name isn't sensitive)
        execSync(`gh variable set ${ENV_VAR_NAME} --body "${bucketName}"`, { stdio: 'inherit' });
        console.log('✅ Added AWS_S3_LOG_BUCKET to GitHub Actions variables');
        return true;
    } catch (error) {
        console.error('❌ Failed to add to GitHub Actions');
        console.error('   You can manually run: gh variable set AWS_S3_LOG_BUCKET --body "' + bucketName + '"');
        return false;
    }
}

async function main() {
    console.log('🪣 S3 Logging Setup\n');

    // Check AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('❌ Missing AWS credentials');
        console.error('   Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
        process.exit(1);
    }

    // Get bucket name from args or use default
    const bucketName = process.argv[2] || process.env.AWS_S3_LOG_BUCKET;

    if (!bucketName) {
        console.error('❌ No bucket name provided');
        console.error('   Usage: yarn setup-s3-logging <bucket-name>');
        console.error('   Or set AWS_S3_LOG_BUCKET environment variable');
        process.exit(1);
    }

    const region = process.env.AWS_REGION || DEFAULT_REGION;

    console.log(`📦 Bucket: ${bucketName}`);
    console.log(`🌍 Region: ${region}\n`);

    const client = new S3Client({
        region,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    // Check if bucket exists and we own it
    let bucketExists = false;
    try {
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
        bucketExists = true;
        console.log('✅ Bucket already exists (you own it)');
    } catch (error: unknown) {
        if (error instanceof Error && 'name' in error && error.name === 'NotFound') {
            console.log('ℹ️  Bucket does not exist, creating...');
        } else if (error instanceof Error && '$metadata' in error) {
            const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
            if (metadata?.httpStatusCode === 404) {
                console.log('ℹ️  Bucket does not exist, creating...');
            } else if (metadata?.httpStatusCode === 403) {
                // 403 could mean: bucket exists but owned by someone else, OR we don't have permission
                // We'll try to create it - if it fails with BucketAlreadyExists, we know it's owned by others
                console.log('ℹ️  Bucket not accessible, attempting to create...');
            } else {
                throw error;
            }
        } else {
            throw error;
        }
    }

    // Create bucket if needed
    if (!bucketExists) {
        try {
            const createParams: {
                Bucket: string;
                CreateBucketConfiguration?: { LocationConstraint: BucketLocationConstraint }
            } = {
                Bucket: bucketName,
            };

            // Note: us-east-1 doesn't need LocationConstraint
            if (region !== 'us-east-1') {
                createParams.CreateBucketConfiguration = {
                    LocationConstraint: region as BucketLocationConstraint,
                };
            }

            await client.send(new CreateBucketCommand(createParams));
            console.log('✅ Bucket created successfully');
        } catch (error: unknown) {
            // Check if bucket name is taken by someone else
            const errorCode = (error as { Code?: string })?.Code;
            if (errorCode === 'BucketAlreadyExists' || errorCode === 'BucketAlreadyOwnedByYou') {
                if (errorCode === 'BucketAlreadyOwnedByYou') {
                    console.log('✅ Bucket already exists (you own it)');
                    bucketExists = true;
                } else {
                    console.error('❌ Bucket name already taken by another AWS account');
                    console.error('');
                    console.error('   S3 bucket names are globally unique across ALL AWS accounts.');
                    console.error('   Try a more unique name, for example:');
                    console.error(`     yarn setup-s3-logging ${bucketName}-${Math.random().toString(36).slice(2, 8)}`);
                    console.error(`     yarn setup-s3-logging my-company-agent-logs-${Date.now()}`);
                    process.exit(1);
                }
            } else {
                console.error('❌ Failed to create bucket:', error);
                process.exit(1);
            }
        }
    }

    // Block all public access (logs should only be accessible with AWS credentials)
    console.log('\n🔒 Ensuring bucket is private...');
    try {
        await client.send(new PutPublicAccessBlockCommand({
            Bucket: bucketName,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                IgnorePublicAcls: true,
                BlockPublicPolicy: true,
                RestrictPublicBuckets: true,
            },
        }));
        console.log('✅ Public access blocked (bucket is private)');
    } catch (error) {
        console.warn('⚠️  Could not set public access block:', error instanceof Error ? error.message : error);
        console.warn('   Please verify bucket is private in AWS Console');
    }

    // Set up lifecycle rule to clean up orphaned logs
    console.log('\n📋 Setting up lifecycle rules...');
    try {
        await client.send(new PutBucketLifecycleConfigurationCommand({
            Bucket: bucketName,
            LifecycleConfiguration: {
                Rules: [
                    {
                        ID: 'CleanupOrphanedAgentLogs',
                        Status: 'Enabled',
                        Filter: {
                            Prefix: LOG_PREFIX,
                        },
                        Expiration: {
                            Days: ORPHAN_CLEANUP_DAYS,
                        },
                    },
                ],
            },
        }));
        console.log(`✅ Lifecycle rule set: Delete logs after ${ORPHAN_CLEANUP_DAYS} days`);
        console.log('   (This cleans up logs from workflows that never completed)');
    } catch (error) {
        console.warn('⚠️  Could not set lifecycle rule:', error instanceof Error ? error.message : error);
        console.warn('   You may want to set this manually to avoid orphaned files');
    }

    // Update .env.local
    console.log('\n📝 Updating .env.local...');
    updateEnvLocal(bucketName);

    // Sync to Vercel
    console.log('\n☁️  Setting env var in Vercel...');
    const vercelSynced = syncToVercel(bucketName);

    // Add to GitHub Actions
    console.log('\n🐙 Adding to GitHub Actions...');
    addToGitHubActions(bucketName);

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('✅ S3 Logging Setup Complete!\n');

    console.log('Environment variable set:');
    console.log(`   ${ENV_VAR_NAME}=${bucketName}`);
    console.log('');
    console.log('Updated:');
    console.log('   ✓ .env.local');
    console.log(vercelSynced ? '   ✓ Vercel' : `   ⚠ Vercel (run: yarn vercel-cli env:set --name ${ENV_VAR_NAME} --value "${bucketName}")`);
    console.log('   ✓ GitHub Actions (as variable)');
    console.log('');
    console.log('Required IAM permissions:');
    console.log('   - s3:GetObject');
    console.log('   - s3:PutObject');
    console.log('   - s3:DeleteObject');
    console.log('   - s3:HeadObject');
    console.log('');
    console.log('Logs will be stored at:');
    console.log(`   s3://${bucketName}/${LOG_PREFIX}issue-{N}.md`);
    console.log('');
}

main().catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
});
