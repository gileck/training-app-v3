/**
 * Log Command
 *
 * Downloads the agent log for a specific issue from S3.
 */

import * as fs from 'fs';
import * as path from 'path';
import { isS3LoggingEnabled, s3ReadLog, s3LogExists } from '@/agents/lib/logging/s3-writer';
import { parseArgs } from '../utils/parse-args';

/**
 * Handle the log command
 */
export async function handleLog(args: string[]): Promise<void> {
    const parsed = parseArgs(args);

    // Get issue number from positional argument or --issue flag
    const issueArg = parsed.issue || args.find(arg => !arg.startsWith('--') && /^\d+$/.test(arg));

    if (!issueArg) {
        console.error('Error: Missing required argument: <issue-number>');
        console.error('Usage: yarn agent-workflow log <issue-number> [--output <path>]');
        process.exit(1);
    }

    const issueNumber = parseInt(issueArg, 10);
    if (isNaN(issueNumber)) {
        console.error(`Error: Invalid issue number: ${issueArg}`);
        process.exit(1);
    }

    // Check if S3 logging is enabled
    if (!isS3LoggingEnabled()) {
        console.error('Error: S3 logging is not enabled.');
        console.error('Set AWS_S3_LOG_BUCKET environment variable to enable S3 logging.');
        process.exit(1);
    }

    // Determine output path (temp-agent-logs is gitignored, separate from synced agent-logs)
    const defaultOutput = path.join('temp-agent-logs', `issue-${issueNumber}.md`);
    const outputPath = parsed.output || defaultOutput;

    console.log(`\nDownloading log for issue #${issueNumber}...`);

    // Check if log exists
    const exists = await s3LogExists(issueNumber);
    if (!exists) {
        console.error(`\nError: No log found for issue #${issueNumber} in S3.`);
        console.error('\nPossible reasons:');
        console.error('  - The issue does not exist or has no log');
        console.error('  - The log was already synced to the repo and deleted from S3');
        console.error('  - The issue workflow has not started yet');
        process.exit(1);
    }

    // Read the log content
    const content = await s3ReadLog(issueNumber);

    if (!content) {
        console.error(`\nError: Log file exists but is empty for issue #${issueNumber}.`);
        process.exit(1);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (outputDir && outputDir !== '.' && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created directory: ${outputDir}`);
    }

    // Write to output file
    fs.writeFileSync(outputPath, content, 'utf-8');

    const fileSizeKB = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(1);
    console.log(`\n✅ Log downloaded successfully!`);
    console.log(`   File: ${outputPath}`);
    console.log(`   Size: ${fileSizeKB} KB`);
    console.log(`   Lines: ${content.split('\n').length}`);
}
