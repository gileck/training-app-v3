/**
 * Rule to ensure API names are imported from index.ts in client files
 * 
 * This rule enforces that client.ts files import API names from their 
 * corresponding index.ts file, never from server.ts.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure API names are imported from index.ts in client files',
            category: 'API Guidelines',
            recommended: true,
        },
        fixable: 'code',
        schema: [{
            type: 'object',
            properties: {
                debug: { type: 'boolean' },
                allowedPaths: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            additionalProperties: false
        }],
        messages: {
            apiNamesFromIndex: 'API names must be imported from index.ts, not from other files',
            suggestIndexImport: 'Import API names from index.ts instead',
        },
    },

    create(context) {
        const options = context.options[0] || {};
        const debug = options.debug || false;
        const allowedPaths = options.allowedPaths || [];

        // Helper to check if imported identifier is an API name
        const isApiName = (name) => {
            // Common API name patterns
            return name === 'name' || name.endsWith('ApiName') || /[A-Z][a-z]+Api$/.test(name);
        };

        // Helper to generate fix
        const generateFix = (fixer, node, importPath) => {
            const newImportPath = importPath.replace(/\/server$/, '/index')
                .replace(/\.server$/, '.index')
                .replace(/^\.\/server$/, './index');
            return fixer.replaceText(node.source, `'${newImportPath}'`);
        };

        return {
            ImportDeclaration(node) {
                const filename = context.getFilename();
                const importSource = node.source.value;

                if (debug) {
                    console.log('API-NAMES-FROM-INDEX checking:', filename);
                    console.log('Import source:', importSource);
                    console.log('Import kind:', node.importKind);
                }

                // Skip if this is a type-only import
                if (node.importKind === 'type') {
                    if (debug) console.log('Skipping type import');
                    return;
                }

                // Skip if all specifiers are type imports
                if (node.specifiers && node.specifiers.length > 0) {
                    const allSpecifiersAreTypes = node.specifiers.every(specifier =>
                        specifier.importKind === 'type'
                    );

                    if (allSpecifiersAreTypes) {
                        if (debug) console.log('Skipping import with all type specifiers');
                        return;
                    }
                }

                // Skip paths in the allowed list
                if (allowedPaths.includes(importSource)) {
                    if (debug) console.log('Skipping allowed path');
                    return;
                }

                // Skip server types utility paths
                if (importSource.includes('@/server/') && importSource.includes('/types')) {
                    if (debug) console.log('Skipping server types utility import');
                    return;
                }

                // Check if this is a client.ts file
                if (filename.endsWith('client.ts') || filename.endsWith('client.tsx')) {
                    // More precise check for server.ts imports
                    const isServerFile = (
                        importSource === './server' ||
                        importSource === '../server' ||
                        importSource.endsWith('/server') ||
                        importSource.endsWith('.server') ||
                        importSource.endsWith('/server.ts') ||
                        importSource.endsWith('.server.ts')
                    );

                    // Check if it's importing API names from a non-index file
                    if (isServerFile || (!importSource.includes('/index') && !importSource.endsWith('/index') && importSource !== './index')) {
                        // Check if any of the imported names are API names
                        const hasApiNames = node.specifiers.some(specifier =>
                            specifier.type === 'ImportSpecifier' && isApiName(specifier.imported.name)
                        );

                        if (hasApiNames) {
                            if (debug) console.log('Reporting non-index API name import');
                            context.report({
                                node,
                                messageId: 'apiNamesFromIndex',
                                fix: (fixer) => generateFix(fixer, node, importSource),
                            });
                        }
                    }
                }
            },
        };
    },
}; 