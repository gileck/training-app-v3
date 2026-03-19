/**
 * ESLint Plugin for API Guidelines Enforcement
 */

module.exports = {
    rules: {
        // Import pattern rules
        'api-names-from-index': require('./rules/api-names-from-index'),
        'server-reexport-from-index': require('./rules/server-reexport-from-index'),

        // Type validation rules
        'client-returns-cache-result': require('./rules/client-returns-cache-result'),
        'no-duplicate-api-types': require('./rules/no-duplicate-api-types'),

        // Other API guidelines
        'no-direct-api-client-call': require('./rules/no-direct-api-client-call'),
        'export-name-from-index': require('./rules/export-name-from-index'),
        'no-export-process-from-index': require('./rules/no-export-process-from-index'),
        
        // Bundle safety
        'no-value-reexport-from-api-index': require('./rules/no-value-reexport-from-api-index'),

        // ID handling
        'prefer-id-utilities': require('./rules/prefer-id-utilities'),
    },
    configs: {
        recommended: {
            plugins: ['api-guidelines'],
            rules: {
                'api-guidelines/api-names-from-index': 'error',
                'api-guidelines/server-reexport-from-index': 'error',
                'api-guidelines/client-returns-cache-result': 'error',
                'api-guidelines/no-duplicate-api-types': 'error',
                'api-guidelines/no-direct-api-client-call': 'error',
                'api-guidelines/export-name-from-index': 'error',
                'api-guidelines/no-export-process-from-index': 'error',
                'api-guidelines/no-value-reexport-from-api-index': 'error',
                // Warning only - suggests using @/server/template/utils for ID conversion
                'api-guidelines/prefer-id-utilities': 'warn',
            }
        }
    }
} 