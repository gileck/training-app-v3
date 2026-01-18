#!/usr/bin/env node
/**
 * List Reports Script
 *
 * Lists bug/error reports from MongoDB with filtering options.
 * Supports both regular reports and investigated reports with fix details.
 *
 * Usage:
 *   node scripts/list-reports.mjs [options]
 *
 * Basic Options:
 *   --status <status>  Filter by report status: new, investigating, resolved, closed (default: new)
 *   --type <type>      Filter by type: bug, error
 *   --limit <n>        Limit number of results (default: 10)
 *
 * Investigation Filters:
 *   --investigated          Show only reports that have been investigated
 *   --inv-status <status>   Filter by investigation status: root_cause_found, complex_fix,
 *                           needs_info, inconclusive, not_a_bug
 *   --confidence <level>    Filter by confidence: low, medium, high
 *   --complexity <level>    Filter by fix complexity: low, medium, high
 *
 * Examples:
 *   # Basic usage
 *   node scripts/list-reports.mjs
 *   node scripts/list-reports.mjs --status investigating
 *   node scripts/list-reports.mjs --type error --limit 20
 *
 *   # Investigated reports
 *   node scripts/list-reports.mjs --investigated
 *   node scripts/list-reports.mjs --inv-status root_cause_found
 *   node scripts/list-reports.mjs --confidence high --complexity low
 */

import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';
import { appConfig } from '../src/app.config.js';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const DB_NAME = appConfig.dbName;

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI or MONGO_URI environment variable is not set');
    process.exit(1);
}

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        status: 'new',
        type: null,
        limit: 10,
        investigated: false,
        invStatus: null,
        confidence: null,
        complexity: null,
        statusExplicitlySet: false,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--status' && i + 1 < args.length) {
            options.status = args[++i];
            options.statusExplicitlySet = true;
        } else if (arg === '--type' && i + 1 < args.length) {
            options.type = args[++i];
        } else if (arg === '--limit' && i + 1 < args.length) {
            options.limit = parseInt(args[++i], 10);
        } else if (arg === '--investigated') {
            options.investigated = true;
        } else if (arg === '--inv-status' && i + 1 < args.length) {
            options.invStatus = args[++i];
            options.investigated = true;
        } else if (arg === '--confidence' && i + 1 < args.length) {
            options.confidence = args[++i];
            options.investigated = true;
        } else if (arg === '--complexity' && i + 1 < args.length) {
            options.complexity = args[++i];
            options.investigated = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
List Reports Script

Usage:
  node scripts/list-reports.mjs [options]

Basic Options:
  --status <status>       Filter by report status: new, investigating, resolved, closed
                          (default: new)
  --type <type>           Filter by type: bug, error
  --limit <n>             Limit number of results (default: 10)

Investigation Filters (for investigated reports):
  --investigated          Show only reports that have been investigated
  --inv-status <status>   Filter by investigation status: root_cause_found,
                          complex_fix, needs_info, inconclusive, not_a_bug
  --confidence <level>    Filter by confidence: low, medium, high
  --complexity <level>    Filter by fix complexity: low, medium, high

Examples:
  # Basic usage
  node scripts/list-reports.mjs
  node scripts/list-reports.mjs --status investigating
  node scripts/list-reports.mjs --type error --limit 20

  # Investigated reports
  node scripts/list-reports.mjs --investigated
  node scripts/list-reports.mjs --inv-status root_cause_found
  node scripts/list-reports.mjs --confidence high --complexity low
  node scripts/list-reports.mjs --status new --inv-status root_cause_found
            `.trim());
            process.exit(0);
        }
    }

    // If using investigation filters without explicit status, default to 'investigating' status
    if (options.investigated && !options.statusExplicitlySet) {
        options.status = 'investigating';
    }

    return options;
}

function formatDate(date) {
    return date.toLocaleString();
}

function truncate(str, maxLen) {
    if (!str) return 'N/A';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
}

function getStatusEmoji(status) {
    const emojis = {
        root_cause_found: '✅',
        complex_fix: '🔧',
        needs_info: '❓',
        inconclusive: '❌',
        not_a_bug: '🚫',
    };
    return emojis[status] || '📋';
}

function getConfidenceEmoji(confidence) {
    const emojis = {
        high: '🔴',
        medium: '🟡',
        low: '🟢',
    };
    return emojis[confidence] || '⚪';
}

function formatReportList(reports, showInvestigation) {
    if (reports.length === 0) {
        return showInvestigation ? 'No investigated reports found.' : 'No reports found.';
    }

    const lines = [
        '================================================================================',
        showInvestigation ? 'INVESTIGATED REPORTS' : 'REPORTS LIST',
        '================================================================================',
        ''
    ];

    reports.forEach((report, index) => {
        const num = `${index + 1}.`.padEnd(4);
        const id = report._id.toHexString();
        const created = formatDate(report.createdAt);

        lines.push(`${num}[${id}]`);

        if (showInvestigation && report.investigation) {
            const inv = report.investigation;
            const statusEmoji = getStatusEmoji(inv.status);
            const confidenceEmoji = getConfidenceEmoji(inv.confidence);
            const invStatus = inv.status.padEnd(18);
            const confidence = inv.confidence.padEnd(8);
            const reportStatus = report.status.padEnd(12);
            const investigatedBy = inv.investigatedBy === 'agent' ? '🤖' : '👤';
            const headline = truncate(inv.headline, 80);
            const fixComplexity = inv.proposedFix?.complexity || 'N/A';
            const filesCount = inv.proposedFix?.files?.length || 0;

            lines.push(`    ${statusEmoji} Investigation: ${invStatus} | Confidence: ${confidenceEmoji} ${confidence} | By: ${investigatedBy}`);
            lines.push(`    Report Status: ${reportStatus} | Created: ${created}`);
            lines.push(`    Headline: ${headline}`);
            if (inv.proposedFix) {
                lines.push(`    Fix: ${fixComplexity} complexity, ${filesCount} file(s) to change`);
            }
        } else {
            const type = report.type.toUpperCase().padEnd(11);
            const status = report.status.padEnd(12);
            const route = truncate(report.route, 30).padEnd(30);
            const message = report.errorMessage || report.description || 'No description';
            const truncatedMessage = truncate(message, 80);

            lines.push(`    Type: ${type} | Status: ${status} | Created: ${created}`);
            lines.push(`    Route: ${route}`);
            lines.push(`    Message: ${truncatedMessage}`);
        }

        lines.push('');
    });

    lines.push('================================================================================');
    lines.push(`Total: ${reports.length} report(s)`);
    lines.push('================================================================================');

    if (showInvestigation) {
        lines.push('');
        lines.push('Legend:');
        lines.push('  ✅ root_cause_found - Ready to fix');
        lines.push('  🔧 complex_fix      - Requires architectural discussion');
        lines.push('  ❓ needs_info       - Need more details');
        lines.push('  ❌ inconclusive     - Root cause unclear');
        lines.push('  🚫 not_a_bug        - Feature request or expected behavior');
        lines.push('');
        lines.push('  🔴 high confidence  🟡 medium confidence  🟢 low confidence');
        lines.push('  🤖 investigated by agent  👤 investigated by human');
    }

    lines.push('');
    lines.push('To view a full report, run:');
    lines.push('  node scripts/get-report.mjs <report-id>');

    return lines.join('\n');
}

async function listReports(options) {
    const client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
    });

    try {
        await client.connect();

        const db = client.db(DB_NAME);
        const collection = db.collection('reports');

        // Build filter
        const filter = {};

        // If any investigation filter is specified, only show investigated reports
        if (options.investigated) {
            filter.investigation = { $exists: true, $ne: null };
        }

        if (options.status) {
            filter.status = options.status;
        }

        if (options.type) {
            filter.type = options.type;
        }

        // Investigation-specific filters
        if (options.invStatus) {
            filter['investigation.status'] = options.invStatus;
        }

        if (options.confidence) {
            filter['investigation.confidence'] = options.confidence;
        }

        if (options.complexity) {
            filter['investigation.proposedFix.complexity'] = options.complexity;
        }

        // Determine sort field - use investigation date if filtering by investigation
        const sortField = options.investigated ? { 'investigation.investigatedAt': -1 } : { createdAt: -1 };

        // Fetch reports
        const reports = await collection
            .find(filter)
            .sort(sortField)
            .limit(options.limit)
            .toArray();

        // Output formatted list
        console.log(formatReportList(reports, options.investigated));

    } catch (error) {
        console.error('Error fetching reports:', error.message || error);
        process.exit(1);
    } finally {
        await client.close();
    }
}

// Main
const options = parseArgs();
await listReports(options);
