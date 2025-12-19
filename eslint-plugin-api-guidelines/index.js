/**
 * ESLint Plugin for API Guidelines Enforcement
 */

module.exports = {
    rules: {
        // Import pattern rules
        'no-server-import-in-client': require('./rules/no-server-import-in-client'),
        'api-names-from-index': require('./rules/api-names-from-index'),
        'server-reexport-from-index': require('./rules/server-reexport-from-index'),

        // Type validation rules
        'client-returns-cache-result': require('./rules/client-returns-cache-result'),
        'no-duplicate-api-types': require('./rules/no-duplicate-api-types'),

        // Other API guidelines
        'no-direct-api-client-call': require('./rules/no-direct-api-client-call'),
        'export-name-from-index': require('./rules/export-name-from-index'),
        'no-export-process-from-index': require('./rules/no-export-process-from-index'),
    },
    configs: {
        recommended: {
            plugins: ['api-guidelines'],
            rules: {
                'api-guidelines/no-server-import-in-client': ['error', {
                    // Allow imports from server utils and types
                    allowedPaths: [
                        '@/server/cache/types',
                        '@/server/types'
                    ]
                }],
                'api-guidelines/api-names-from-index': 'error',
                'api-guidelines/server-reexport-from-index': 'error',
                'api-guidelines/client-returns-cache-result': 'error',
                'api-guidelines/no-duplicate-api-types': 'error',
                'api-guidelines/no-direct-api-client-call': 'error',
                'api-guidelines/export-name-from-index': 'error',
                'api-guidelines/no-export-process-from-index': 'error',
            }
        }
    }
} 