/**
 * Rule to warn about direct ObjectId method usage that may fail with UUID strings.
 * 
 * This app supports both MongoDB ObjectIds and client-generated UUIDs for _id fields.
 * Direct ObjectId methods like .toHexString() will fail on UUID strings.
 * 
 * Recommends using @/server/utils instead:
 * - toStringId() instead of .toHexString()
 * - toQueryId() instead of new ObjectId() in queries
 * - toDocumentId() instead of new ObjectId() for document insertion
 */

module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Prefer server ID utilities over direct ObjectId methods',
            category: 'API Guidelines',
            recommended: true,
        },
        fixable: null,
        schema: [],
        messages: {
            preferToStringId: 
                'Avoid .toHexString() - it fails on UUID strings. Use toStringId() from @/server/utils instead.',
            preferIdUtility: 
                'new ObjectId(variable) may fail on UUID strings. Consider using toQueryId() or toDocumentId() from @/server/utils.',
        },
    },

    create(context) {
        const filename = context.getFilename();
        
        // Only apply to API handlers (src/apis/) - not to database layer
        const isApiHandler = filename.includes('/apis/') || filename.includes('\\apis\\');
        
        if (!isApiHandler) {
            return {};
        }

        return {
            // Detect .toHexString() calls
            CallExpression(node) {
                if (
                    node.callee.type === 'MemberExpression' &&
                    node.callee.property.type === 'Identifier' &&
                    node.callee.property.name === 'toHexString'
                ) {
                    context.report({
                        node,
                        messageId: 'preferToStringId',
                    });
                }
            },

            // Detect new ObjectId(variable) - but not new ObjectId() with no args
            NewExpression(node) {
                if (
                    node.callee.type === 'Identifier' &&
                    node.callee.name === 'ObjectId' &&
                    node.arguments.length > 0
                ) {
                    const arg = node.arguments[0];
                    
                    // Allow literal strings (likely known ObjectId format)
                    if (arg.type === 'Literal' && typeof arg.value === 'string') {
                        return;
                    }
                    
                    // Warn on variables/expressions (could be UUID)
                    context.report({
                        node,
                        messageId: 'preferIdUtility',
                    });
                }
            },
        };
    },
};
