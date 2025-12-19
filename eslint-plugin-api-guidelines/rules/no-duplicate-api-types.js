/**
 * Rule to prevent duplicate API type definitions
 * 
 * This rule prevents developers from redefining types that should be
 * defined in an API's types.ts file.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prevent duplicate API type definitions',
            category: 'API Guidelines',
            recommended: true,
        },
        fixable: null,
        schema: [],
        messages: {
            noDuplicateTypes: 'Do not redefine types that should be imported from an API types.ts file.',
            importFromApiTypes: 'Import types from the corresponding API types.ts file instead.',
        },
    },

    create(context) {
        // Common patterns for API types we should detect
        const apiTypePatterns = [
            /Request$/,
            /Response$/,
            /ApiRequest$/,
            /ApiResponse$/,
            /Dto$/,
        ];

        return {
            // Check TypeScript type aliases
            TSTypeAliasDeclaration(node) {
                const filename = context.getFilename();

                // Skip checking files that are themselves API type files
                if (filename.includes('/apis/') && filename.endsWith('types.ts')) {
                    return;
                }

                const typeName = node.id.name;

                // Check if this follows an API type naming convention
                const isLikelyApiType = apiTypePatterns.some(pattern => pattern.test(typeName));

                if (isLikelyApiType) {
                    context.report({
                        node,
                        messageId: 'noDuplicateTypes',
                        data: { typeName },
                    });
                }
            },

            // Check TypeScript interfaces
            TSInterfaceDeclaration(node) {
                const filename = context.getFilename();

                // Skip checking files that are themselves API type files
                if (filename.includes('/apis/') && filename.endsWith('types.ts')) {
                    return;
                }

                const typeName = node.id.name;

                // Check if this follows an API type naming convention
                const isLikelyApiType = apiTypePatterns.some(pattern => pattern.test(typeName));

                if (isLikelyApiType) {
                    context.report({
                        node,
                        messageId: 'noDuplicateTypes',
                        data: { typeName },
                    });
                }
            },
        };
    },
}; 