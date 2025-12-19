/**
 * ESLint rule: prefer-state-architecture
 * 
 * Warns when useState is used without explicit justification.
 * Forces developers to think about whether useState is appropriate
 * vs. React Query (server state) or Zustand (persistent client state).
 * 
 * To suppress, add a comment explaining why useState is correct:
 * // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral modal state
 * const [isOpen, setIsOpen] = useState(false);
 */

module.exports = {
    meta: {
        type: "suggestion",
        docs: {
            description: "Enforce conscious decision when using useState vs React Query/Zustand",
            category: "Best Practices",
            recommended: true,
        },
        messages: {
            preferStateArchitecture: 
                "useState detected. Consider: Is this server data (use React Query) or persistent state (use Zustand)? " +
                "If useState is correct for ephemeral UI state, add a disable comment with explanation: " +
                "// eslint-disable-next-line state-management/prefer-state-architecture -- [your reason]"
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                // Check if it's a useState call
                if (
                    node.callee.type === "Identifier" &&
                    node.callee.name === "useState"
                ) {
                    context.report({
                        node,
                        messageId: "preferStateArchitecture",
                    });
                }
            },
        };
    },
};

