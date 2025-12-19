/**
 * Rule to prevent exporting process functions from index.ts
 * 
 * This rule enforces that index.ts files in API modules don't export server 
 * implementation details like process functions, which would cause them to be
 * bundled with client-side code.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prevent exporting process functions from index.ts',
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
            noProcessExport: 'Do not export process functions from index.ts',
            noClientFunctionsExport: 'Do not export client functions from index.ts',
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

        // Only check index.ts files in API directories
        if (!filename.includes('/apis/') || !filename.endsWith('index.ts')) {
            return {};
        }

        //check that the index.ts file is a direct child of the api directory - meaning its path id exactly /apis/api-name/index.ts
        const pathRegex = /\/apis\/[^\/]+\/index\.ts$/;
        // Skip index.ts files that are in deeper subdirectories (like /apis/api-name/actions/index.ts)
        const deeperPathRegex = /\/apis\/[^\/]+\/[^\/]+\/.*index\.ts$/;
        if (!pathRegex.test(filename) || deeperPathRegex.test(filename)) {
            return {};
        }

        return {
            // Check for exports
            ExportNamedDeclaration(node) {
                if (node.specifiers) {
                    // Handle named exports
                    node.specifiers.forEach(specifier => {
                        const exportedName = specifier.exported.name;

                        // Check for process functions
                        if (exportedName === 'process' ||
                            exportedName.startsWith('process') ||
                            exportedName.endsWith('process') ||
                            exportedName.includes('Process')) {
                            context.report({
                                node,
                                messageId: 'noProcessExport',
                                fix: (fixer) => {
                                    // Remove this export
                                    return fixer.remove(node);
                                }
                            });
                        }

                        // Check for client API functions that shouldn't be exported from index
                        if (exportedName.startsWith('get') ||
                            exportedName.startsWith('fetch') ||
                            exportedName.startsWith('post') ||
                            exportedName.startsWith('update') ||
                            exportedName.startsWith('delete') ||
                            exportedName.startsWith('create') ||
                            exportedName.endsWith('Client')) {
                            context.report({
                                node,
                                messageId: 'noClientFunctionsExport',
                                fix: (fixer) => {
                                    // Remove this export
                                    return fixer.remove(node);
                                }
                            });
                        }
                    });
                }

                // Handle direct function exports
                if (node.declaration &&
                    (node.declaration.type === 'FunctionDeclaration' ||
                        node.declaration.type === 'ArrowFunctionExpression')) {
                    const functionName = node.declaration.id ?
                        node.declaration.id.name :
                        context.getScope().block.id.name;

                    if (functionName === 'process' ||
                        functionName.startsWith('process') ||
                        functionName.endsWith('process') ||
                        functionName.includes('Process')) {
                        context.report({
                            node,
                            messageId: 'noProcessExport',
                            fix: (fixer) => {
                                // Remove this export
                                return fixer.remove(node);
                            }
                        });
                    }

                    // Check for client API functions
                    if (functionName.startsWith('get') ||
                        functionName.startsWith('fetch') ||
                        functionName.startsWith('post') ||
                        functionName.startsWith('update') ||
                        functionName.startsWith('delete') ||
                        functionName.startsWith('create') ||
                        functionName.endsWith('Client')) {
                        context.report({
                            node,
                            messageId: 'noClientFunctionsExport',
                            fix: (fixer) => {
                                // Remove this export
                                return fixer.remove(node);
                            }
                        });
                    }
                }
            },
        };
    },
}; 