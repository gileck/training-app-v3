#!/usr/bin/env npx tsx
/**
 * Test S3 Logging Functions
 *
 * Verifies S3 read/write/append/delete operations work correctly.
 * Uses a test issue number (99999) to avoid conflicts with real logs.
 *
 * Usage:
 *   yarn test-s3-logging
 */

// Load environment variables
import '../../src/agents/shared/loadEnv';

import {
    isS3LoggingEnabled,
    getS3LogKey,
    s3LogExists,
    s3ReadLog,
    s3WriteLog,
    s3AppendToLog,
    s3DeleteLog,
} from '../../src/agents/lib/logging/s3-writer';

const TEST_ISSUE_NUMBER = 99999;

async function main() {
    console.log('🧪 S3 Logging Test\n');

    // Check if S3 logging is enabled
    console.log('1. Checking S3 logging configuration...');
    if (!isS3LoggingEnabled()) {
        console.error('❌ S3 logging is not enabled');
        console.error('   Set AWS_S3_LOG_BUCKET environment variable');
        process.exit(1);
    }
    console.log('   ✅ S3 logging is enabled');
    console.log(`   📍 Key: ${getS3LogKey(TEST_ISSUE_NUMBER)}\n`);

    // Clean up any existing test file
    console.log('2. Cleaning up any existing test file...');
    try {
        await s3DeleteLog(TEST_ISSUE_NUMBER);
        console.log('   ✅ Cleanup complete\n');
    } catch (error) {
        console.log('   ✅ No existing file to clean up\n');
    }

    // Test write
    console.log('3. Testing write...');
    const initialContent = `# Test Log for Issue #${TEST_ISSUE_NUMBER}\n\nCreated at: ${new Date().toISOString()}\n`;
    try {
        await s3WriteLog(TEST_ISSUE_NUMBER, initialContent);
        console.log('   ✅ Write successful\n');
    } catch (error) {
        console.error('   ❌ Write failed:', error);
        process.exit(1);
    }

    // Test exists
    console.log('4. Testing exists check...');
    try {
        const exists = await s3LogExists(TEST_ISSUE_NUMBER);
        if (exists) {
            console.log('   ✅ File exists check passed\n');
        } else {
            console.error('   ❌ File should exist but check returned false');
            process.exit(1);
        }
    } catch (error) {
        console.error('   ❌ Exists check failed:', error);
        process.exit(1);
    }

    // Test read
    console.log('5. Testing read...');
    try {
        const content = await s3ReadLog(TEST_ISSUE_NUMBER);
        if (content === initialContent) {
            console.log('   ✅ Read content matches written content\n');
        } else {
            console.error('   ❌ Content mismatch');
            console.error('   Expected:', JSON.stringify(initialContent));
            console.error('   Got:', JSON.stringify(content));
            process.exit(1);
        }
    } catch (error) {
        console.error('   ❌ Read failed:', error);
        process.exit(1);
    }

    // Test append
    console.log('6. Testing append...');
    const appendContent = '\n## Append Test\n\nThis line was appended.\n';
    try {
        await s3AppendToLog(TEST_ISSUE_NUMBER, appendContent);
        console.log('   ✅ Append successful\n');
    } catch (error) {
        console.error('   ❌ Append failed:', error);
        process.exit(1);
    }

    // Verify append
    console.log('7. Verifying append...');
    try {
        const content = await s3ReadLog(TEST_ISSUE_NUMBER);
        const expectedContent = initialContent + appendContent;
        if (content === expectedContent) {
            console.log('   ✅ Appended content verified\n');
        } else {
            console.error('   ❌ Appended content mismatch');
            console.error('   Expected length:', expectedContent.length);
            console.error('   Got length:', content.length);
            process.exit(1);
        }
    } catch (error) {
        console.error('   ❌ Read after append failed:', error);
        process.exit(1);
    }

    // Test delete
    console.log('8. Testing delete...');
    try {
        await s3DeleteLog(TEST_ISSUE_NUMBER);
        console.log('   ✅ Delete successful\n');
    } catch (error) {
        console.error('   ❌ Delete failed:', error);
        process.exit(1);
    }

    // Verify delete
    console.log('9. Verifying delete...');
    try {
        const exists = await s3LogExists(TEST_ISSUE_NUMBER);
        if (!exists) {
            console.log('   ✅ File no longer exists\n');
        } else {
            console.error('   ❌ File should be deleted but still exists');
            process.exit(1);
        }
    } catch (error) {
        console.error('   ❌ Exists check after delete failed:', error);
        process.exit(1);
    }

    // Test reading non-existent file
    console.log('10. Testing read of non-existent file...');
    try {
        const content = await s3ReadLog(TEST_ISSUE_NUMBER);
        if (content === '') {
            console.log('    ✅ Returns empty string for non-existent file\n');
        } else {
            console.error('    ❌ Should return empty string for non-existent file');
            process.exit(1);
        }
    } catch (error) {
        console.error('    ❌ Read of non-existent file threw error:', error);
        process.exit(1);
    }

    console.log('═'.repeat(50));
    console.log('✅ All S3 logging tests passed!\n');
}

main().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
