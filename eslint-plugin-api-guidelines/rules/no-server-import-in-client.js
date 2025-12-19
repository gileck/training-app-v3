/**
 * Rule to prevent importing server.ts in client.ts files
 * 
 * This rule enforces the pattern that client code must NEVER import from server.ts,
 * ensuring proper separation of client and server code.
 * Types are allowed to be imported from anywhere.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prevent client.ts files from importing server.ts files (except for types)',
            category: 'API Guidelines',
            recommended: true,
        },
        fixable: null,
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
            noServerImport: 'Client code must not import from server.ts. Import API names from index.ts instead.',
        },
    },

    create(context) {
        const options = context.options[0] || {};
        const debug = options.debug || false;
        const allowedPaths = options.allowedPaths || [];

        return {
            ImportDeclaration(node) {
                const filename = context.getFilename();
                const importSource = node.source.value;

                if (debug) {
                    console.log('Checking import in file:', filename);
                    console.log('Import source:', importSource);
                    console.log('Import kind:', node.importKind);
                    if (node.specifiers && node.specifiers.length > 0) {
                        console.log('Specifiers:', node.specifiers.map(s => ({
                            name: s.local?.name,
                            importKind: s.importKind,
                            type: s.type
                        })));
                    }
                }

                // Check if this is a client.ts file
                if (filename.endsWith('client.ts') || filename.endsWith('client.tsx')) {
                    // Check if the import path is in the allowed list
                    if (allowedPaths.includes(importSource)) {
                        if (debug) console.log('Allowing import from allowedPaths list');
                        return;
                    }

                    // Always allow type imports regardless of the import source
                    if (node.importKind === 'type') {
                        if (debug) console.log('Allowing type import');
                        return;
                    }

                    // Always allow imports where all specifiers are type imports
                    if (node.specifiers && node.specifiers.length > 0) {
                        const allSpecifiersAreTypes = node.specifiers.every(specifier => {
                            return specifier.importKind === 'type';
                        });

                        if (allSpecifiersAreTypes) {
                            if (debug) console.log('Allowing import where all specifiers are types');
                            return;
                        }
                    }

                    // Specific check for common server utility paths that should be allowed for types
                    if (importSource.includes('@/server/') && importSource.includes('/types')) {
                        if (debug) console.log('Allowing import from server types module');
                        return;
                    }

                    // Always allow relative imports from index
                    if (importSource === './index' || importSource.endsWith('/index')) {
                        if (debug) console.log('Allowing import from local index');
                        return;
                    }

                    // More precise check for server.ts imports - detect actual server.ts files
                    // rather than utility paths that happen to contain "server" in them
                    const isServerFile = (
                        importSource === './server' ||
                        importSource === '../server' ||
                        importSource.endsWith('/server') ||
                        importSource.endsWith('.server') ||
                        importSource.endsWith('/server.ts') ||
                        importSource.endsWith('.server.ts')
                    );

                    if (isServerFile) {
                        if (debug) console.log('Reporting server import');
                        context.report({
                            node,
                            messageId: 'noServerImport',
                        });
                    }
                }
            },
        };
    },
}; 