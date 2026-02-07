/**
 * Rule to prevent value re-exports from API index.ts files.
 *
 * API index.ts files are imported by client code. If they re-export values
 * from other modules (e.g. server utilities), the bundler follows the chain
 * and pulls server-only code (like MongoDB) into the client bundle.
 *
 * Allowed in API index files:
 *   - `export const name = '...'`        (API name declaration)
 *   - `export const API_FOO = '...'`     (API endpoint constants)
 *   - `export type { Foo } from '...'`   (type-only re-exports)
 *   - `export type * from '...'`         (type-only wildcard re-exports)
 *
 * Disallowed:
 *   - `export { foo } from './utils'`    (value re-export)
 *   - `export * from './types'`          (wildcard - could include values)
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prevent value re-exports from API index.ts files that could leak server code into client bundles',
            category: 'API Guidelines',
            recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
            noValueReexport:
                'Value re-export from API index.ts can leak server code into the client bundle. Use `export type { ... }` for types or move values to a separate module.',
            noWildcardReexport:
                'Wildcard re-export from API index.ts may leak server code into the client bundle. Use `export type * from ...` instead.',
        },
    },

    create(context) {
        const filename = context.getFilename();

        // Only check index.ts files inside src/apis/ subdirectories
        if (!filename.includes('/apis/') || !filename.endsWith('index.ts')) {
            return {};
        }

        // Skip the root src/apis/index.ts - it legitimately re-exports API namespaces
        if (/\/apis\/index\.ts$/.test(filename)) {
            return {};
        }

        return {
            ExportNamedDeclaration(node) {
                // Skip if no source (not a re-export, it's a local declaration)
                if (!node.source) {
                    return;
                }

                // Skip type-only exports: `export type { ... } from '...'`
                if (node.exportKind === 'type') {
                    return;
                }

                // Check individual specifiers - some may be type-only
                if (node.specifiers && node.specifiers.length > 0) {
                    const valueSpecifiers = node.specifiers.filter(
                        s => s.exportKind !== 'type'
                    );
                    if (valueSpecifiers.length > 0) {
                        context.report({
                            node,
                            messageId: 'noValueReexport',
                        });
                    }
                    return;
                }

                // No specifiers + has source = shouldn't happen for named exports,
                // but handle defensively
            },

            ExportAllDeclaration(node) {
                // `export type * from '...'` is fine
                if (node.exportKind === 'type') {
                    return;
                }

                // `export * from '...'` - wildcard value re-export
                context.report({
                    node,
                    messageId: 'noWildcardReexport',
                    fix(fixer) {
                        // Auto-fix: insert `type ` after `export `
                        const exportToken = context.getSourceCode().getFirstToken(node);
                        return fixer.insertTextAfter(exportToken, ' type');
                    },
                });
            },
        };
    },
};
