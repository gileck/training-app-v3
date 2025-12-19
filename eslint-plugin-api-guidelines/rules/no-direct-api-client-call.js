/**
 * Rule to prevent direct apiClient calls from components
 * 
 * This rule enforces that components must use domain-specific client functions
 * instead of calling apiClient.call directly.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prevent direct apiClient calls from components',
            category: 'API Guidelines',
            recommended: true,
        },
        fixable: null,
        schema: [],
        messages: {
            noDirectApiCall: 'Do not call apiClient directly from components. Use domain-specific client functions instead.',
        },
    },

    create(context) {
        return {
            // Check for direct apiClient.call usage
            MemberExpression(node) {
                // Only check in React component or page files
                const filename = context.getFilename();
                const isComponentOrPage =
                    (filename.includes('/components/') ||
                        filename.includes('/pages/') ||
                        filename.includes('/features/')) &&
                    !filename.includes('/apis/') &&
                    !filename.endsWith('client.ts') &&
                    !filename.endsWith('client.tsx');

                if (!isComponentOrPage) {
                    return;
                }

                // Check if this is accessing apiClient.call
                if (node.object &&
                    node.object.name === 'apiClient' &&
                    node.property &&
                    node.property.name === 'call') {
                    context.report({
                        node,
                        messageId: 'noDirectApiCall',
                    });
                }

                // Also check for imported apiClient
                if (node.object &&
                    node.object.type === 'Identifier' &&
                    node.property &&
                    node.property.name === 'call') {
                    // We need to check if the object might be an imported apiClient
                    const scope = context.getScope();
                    const variable = scope.variables.find(v => v.name === node.object.name);

                    if (variable && variable.defs && variable.defs.length > 0) {
                        const def = variable.defs[0];
                        if (def.type === 'ImportBinding' &&
                            def.node &&
                            def.node.source &&
                            def.node.source.value.includes('apiClient')) {
                            context.report({
                                node,
                                messageId: 'noDirectApiCall',
                            });
                        }
                    }
                }
            },
        };
    },
}; 