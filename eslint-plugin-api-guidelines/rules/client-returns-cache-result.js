/**
 * Rule to ensure client functions return CacheResult<T> type
 * 
 * This rule enforces that client API functions properly wrap their return types
 * with CacheResult<T> to handle caching metadata.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure client API functions return CacheResult<T> type',
            category: 'API Guidelines',
            recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
            mustReturnCacheResult: 'Client API functions must return CacheResult<T> type',
            importCacheResult: 'Missing CacheResult import. Import it from "@/server/cache/types"',
        },
    },

    create(context) {
        let hasCacheResultImport = false;
        let needsCacheResultImport = false;

        // Shared function to check return types
        function checkFunctionReturnType(node) {
            const filename = context.getFilename();

            // Only apply to client.ts files
            if (!filename.endsWith('client.ts') && !filename.endsWith('client.tsx')) {
                return;
            }

            // Check that this is an exported function
            const parent = node.parent;
            const isExported = parent &&
                (parent.type === 'ExportNamedDeclaration' ||
                    (parent.type === 'VariableDeclarator' &&
                        parent.parent &&
                        parent.parent.parent &&
                        parent.parent.parent.type === 'ExportNamedDeclaration'));

            if (!isExported) {
                return;
            }

            // Check return type - TypeScript-specific AST
            if (node.returnType && node.returnType.typeAnnotation) {
                const returnType = context.getSourceCode().getText(node.returnType.typeAnnotation);

                // Check if this is likely an API function
                const isLikelyApiFunction = returnType.includes('Promise<') &&
                    (node.async || returnType.includes('Promise'));

                if (isLikelyApiFunction) {
                    needsCacheResultImport = true;

                    // Check if return type includes CacheResult
                    if (!returnType.includes('CacheResult<') && !returnType.includes('Cache.Result<')) {
                        context.report({
                            node: node.returnType,
                            messageId: 'mustReturnCacheResult',
                        });
                    }
                }
            }
        }

        return {
            // Check for CacheResult import
            ImportDeclaration(node) {
                const importSource = node.source.value;

                if (importSource.includes('cache/types')) {
                    const hasTypeImport = node.specifiers.some(specifier =>
                        (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'CacheResult') ||
                        (specifier.type === 'ImportNamespaceSpecifier')
                    );

                    if (hasTypeImport) {
                        hasCacheResultImport = true;
                    }
                }
            },

            // Check function return types
            FunctionDeclaration(node) {
                checkFunctionReturnType(node);
            },

            ArrowFunctionExpression(node) {
                checkFunctionReturnType(node);
            },

            // At the end of the file, check if we needed CacheResult but didn't have it
            'Program:exit'() {
                const filename = context.getFilename();

                // Only apply to client.ts files
                if (!filename.endsWith('client.ts') && !filename.endsWith('client.tsx')) {
                    return;
                }

                // If we found API functions but no CacheResult import, report it
                if (!hasCacheResultImport && needsCacheResultImport) {
                    context.report({
                        loc: { line: 1, column: 0 },
                        messageId: 'importCacheResult',
                    });
                }
            }
        };
    },
}; 