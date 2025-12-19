#!/usr/bin/env node
/**
 * Get Report Details Script
 * 
 * Fetches a bug/error report directly from MongoDB by ID.
 * 
 * Usage:
 *   node scripts/get-report.mjs <report-id>
 * 
 * Example:
 *   node scripts/get-report.mjs 692f08157586bdebbe6f3042
 */

import { MongoClient, ObjectId } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const DB_NAME = 'app_template_db';

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI or MONGO_URI environment variable is not set');
    process.exit(1);
}

function formatDate(date) {
    return date.toLocaleString();
}

function formatReport(report) {
    const sessionLogsFormatted = report.sessionLogs && report.sessionLogs.length > 0
        ? report.sessionLogs.map(log => 
            `  [${log.timestamp}]${log.performanceTime !== undefined ? ` [+${log.performanceTime}ms]` : ''} [${log.level.toUpperCase()}] [${log.feature}] ${log.message}${log.meta ? ` | Meta: ${JSON.stringify(log.meta)}` : ''}${log.route ? ` | Route: ${log.route}` : ''} | Network: ${log.networkStatus}`
        ).join('\n')
        : '  No session logs';

    const performanceEntriesFormatted = report.performanceEntries && report.performanceEntries.length > 0
        ? report.performanceEntries.map(entry => 
            `  [${entry.entryType}] ${entry.name} | Start: ${entry.startTime}ms | Duration: ${entry.duration}ms${entry.transferSize ? ` | Size: ${entry.transferSize}B` : ''}`
        ).join('\n')
        : null;

    return `
================================================================================
BUG/ERROR REPORT
================================================================================

REPORT METADATA
---------------
- Report ID: ${report._id.toHexString()}
- Type: ${report.type.toUpperCase()}${report.category ? ` (${report.category})` : ''}
- Status: ${report.status}
- Created: ${formatDate(report.createdAt)}
- Updated: ${formatDate(report.updatedAt)}

CONTEXT
-------
- Route/Page: ${report.route}
- Network Status: ${report.networkStatus}

${report.description ? `DESCRIPTION
-----------
${report.description}
` : ''}
${report.errorMessage ? `ERROR MESSAGE
-------------
${report.errorMessage}
` : ''}
${report.stackTrace ? `STACK TRACE
-----------
${report.stackTrace}
` : ''}
USER INFORMATION
----------------
${report.userInfo ? `- User ID: ${report.userInfo.userId || 'N/A'}
- Username: ${report.userInfo.username || 'N/A'}
- Email: ${report.userInfo.email || 'N/A'}` : '- User: Anonymous (not logged in)'}

BROWSER/DEVICE INFORMATION
--------------------------
- User Agent: ${report.browserInfo.userAgent}
- Viewport: ${report.browserInfo.viewport.width}x${report.browserInfo.viewport.height}
- Language: ${report.browserInfo.language}

${report.screenshot ? `SCREENSHOT
----------
[Base64 image data included - ${Math.round(report.screenshot.length / 1024)}KB]
` : ''}
${performanceEntriesFormatted ? `PERFORMANCE ENTRIES (${report.performanceEntries?.length || 0} entries)
--------------------------------------------------------
${performanceEntriesFormatted}
` : ''}
SESSION LOGS (${report.sessionLogs?.length || 0} entries)
--------------------------------------------------
${sessionLogsFormatted}

================================================================================
END OF REPORT
================================================================================
    `.trim();
}

async function getReport(reportId) {
    const client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
    });
    
    try {
        await client.connect();
        
        const db = client.db(DB_NAME);
        const collection = db.collection('reports');
        
        // Validate ObjectId format
        if (!ObjectId.isValid(reportId)) {
            console.error(`Error: Invalid report ID format: ${reportId}`);
            process.exit(1);
        }
        
        const report = await collection.findOne({ _id: new ObjectId(reportId) });
        
        if (!report) {
            console.error(`Error: Report not found with ID: ${reportId}`);
            process.exit(1);
        }
        
        // Output formatted report to stdout
        console.log(formatReport(report));
        
    } catch (error) {
        console.error('Error fetching report:', error.message || error);
        process.exit(1);
    } finally {
        await client.close();
    }
}

// Main
const reportId = process.argv[2];

if (!reportId) {
    console.error('Usage: node scripts/get-report.mjs <report-id>');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/get-report.mjs 692f08157586bdebbe6f3042');
    process.exit(1);
}

await getReport(reportId);

