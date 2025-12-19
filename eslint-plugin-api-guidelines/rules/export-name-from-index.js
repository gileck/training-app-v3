/**
 * Rule to ensure index.ts exports API names
 * 
 * This rule enforces that index.ts files in API modules export the API name constants
 * that are used for routing API calls.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure index.ts exports API names',
            category: 'API Guidelines',
            recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
            mustExportName: 'API index.ts must export the "name" constant',
            mustExportApiNames: 'API index.ts should export all API names for multi-endpoint APIs',
        },
    },

    create(context) {
        const filename = context.getFilename();

        // Only check index.ts files in API directories
        if (!filename.includes('/apis/') || !filename.endsWith('index.ts')) {
            return {};
        }

        // Track exports
        let hasNameExport = false;
        const apiNameExports = new Set();

        return {
            // Check for exports
            ExportNamedDeclaration(node) {
                if (node.declaration) {
                    // Handle variable declarations
                    if (node.declaration.type === 'VariableDeclaration') {
                        node.declaration.declarations.forEach(decl => {
                            if (decl.id.name === 'name') {
                                hasNameExport = true;
                            } else if (decl.id.name.endsWith('ApiName')) {
                                apiNameExports.add(decl.id.name);
                            }
                        });
                    }
                } else if (node.specifiers) {
                    // Handle named exports
                    node.specifiers.forEach(specifier => {
                        if (specifier.exported.name === 'name') {
                            hasNameExport = true;
                        } else if (specifier.exported.name.endsWith('ApiName')) {
                            apiNameExports.add(specifier.exported.name);
                        }
                    });
                }
            },

            // At the end of the file, check if we've seen the required exports
            'Program:exit'() {
                if (!hasNameExport) {
                    context.report({
                        loc: { line: 1, column: 0 },
                        messageId: 'mustExportName',
                        fix: (fixer) => {
                            // Suggest adding name export
                            return fixer.insertTextAfterRange(
                                [0, 0],
                                "export const name = 'your-api-name';\n\n"
                            );
                        }
                    });
                }
            }
        };
    },
}; 