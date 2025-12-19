/**
 * Rule to ensure server.ts re-exports all API names from index.ts
 * 
 * This rule enforces that server.ts files re-export the API names from their
 * corresponding index.ts file, ensuring proper APIs architecture.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure server.ts re-exports API names from index.ts',
            category: 'API Guidelines',
            recommended: true,
        },
        fixable: 'code',
        schema: [{
            type: 'object',
            properties: {
                ignorePatterns: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            additionalProperties: false
        }],
        messages: {
            reExportFromIndex: 'Re-export API names from index.ts instead',
            noDirectApiName: 'API names must be re-exported from index.ts, not defined directly in server.ts',
        },
    },

    create(context) {
        const filename = context.getFilename();
        const options = context.options[0] || {};
        const ignorePatterns = options.ignorePatterns || [];

        // Skip if filename matches any of the ignore patterns
        if (ignorePatterns.some(pattern => {
            // Convert glob pattern to regex
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            const regex = new RegExp(regexPattern);
            return regex.test(filename);
        })) {
            return {};
        }

        // Only check server.ts files in API directories
        if (!filename.includes('/apis/') || !filename.endsWith('server.ts')) {
            return {};
        }

        // Track imports from index.ts
        let hasIndexImport = false;
        let importedApiNames = [];
        let hasNameExport = false;

        return {
            // Check for imports
            ImportDeclaration(node) {
                const importSource = node.source.value;

                // Check if importing from index.ts
                if (importSource === './index' || importSource.endsWith('/index')) {
                    hasIndexImport = true;

                    // Track imported API names
                    node.specifiers.forEach(specifier => {
                        if (specifier.type === 'ImportSpecifier') {
                            importedApiNames.push(specifier.imported.name);
                        }
                    });
                }
            },

            // Check for exports
            ExportNamedDeclaration(node) {
                // If this export is a re-export from index.ts, set hasIndexImport
                if (node.source && (node.source.value === './index' || node.source.value.endsWith('/index'))) {
                    hasIndexImport = true;
                    // Collect re-exported names if necessary for other checks (similar to ImportDeclaration)
                    node.specifiers.forEach(specifier => {
                        if (specifier.type === 'ExportSpecifier') {
                            importedApiNames.push(specifier.local.name); // local.name is the original name in index.ts
                        }
                    });
                }

                // Check for exports of 'name' - a common API identifier
                if (node.specifiers) {
                    node.specifiers.forEach(specifier => {
                        if (specifier.exported.name === 'name') {
                            hasNameExport = true;

                            // Check if it's not re-exported from index.ts
                            if (!importedApiNames.includes('name')) {
                                context.report({
                                    node,
                                    messageId: 'noDirectApiName',
                                    fix: (fixer) => {
                                        // Add import from index.ts if not already present
                                        if (!hasIndexImport) {
                                            return fixer.insertTextBefore(
                                                context.getSourceCode().ast.body[0],
                                                "import { name } from './index';\n\n"
                                            );
                                        }
                                        return null;
                                    }
                                });
                            }
                        }
                    });
                }
            },

            // Check for wildcard re-exports from index.ts
            ExportAllDeclaration(node) {
                if (node.source && (node.source.value === './index' || node.source.value.endsWith('/index'))) {
                    hasIndexImport = true;
                }
            },

            // Check at the end of the program
            'Program:exit'() {
                // If no import from index.ts, report an error
                if (!hasIndexImport) {
                    context.report({
                        loc: { line: 1, column: 0 },
                        messageId: 'reExportFromIndex',
                        fix: (fixer) => {
                            return fixer.insertTextBefore(
                                context.getSourceCode().ast.body[0],
                                "import { name } from './index';\n\n"
                            );
                        }
                    });
                }
            }
        };
    },
}; 