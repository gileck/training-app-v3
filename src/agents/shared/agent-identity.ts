/**
 * Agent Identity Helpers
 *
 * Provides prefixes for agent-generated content to distinguish between different agents
 * when they all use the same bot account.
 */

export type AgentName =
    | 'product-dev'
    | 'product-design'
    | 'tech-design'
    | 'implementor'
    | 'pr-review'
    | 'auto-advance'
    | 'bug-investigator';

/**
 * Agent display names and emojis
 */
const AGENT_INFO: Record<AgentName, { name: string; emoji: string }> = {
    'product-dev': { name: 'Product Development Agent', emoji: '📋' },
    'product-design': { name: 'Product Design Agent', emoji: '🎨' },
    'tech-design': { name: 'Tech Design Agent', emoji: '🏗️' },
    'implementor': { name: 'Implementor Agent', emoji: '⚙️' },
    'pr-review': { name: 'PR Review Agent', emoji: '👀' },
    'auto-advance': { name: 'Auto-Advance Agent', emoji: '⏭️' },
    'bug-investigator': { name: 'Bug Investigator Agent', emoji: '🔍' },
};

/**
 * Add agent prefix to a comment or message
 */
export function addAgentPrefix(agent: AgentName, content: string): string {
    const info = AGENT_INFO[agent];
    return `${info.emoji} **[${info.name}]**\n\n${content}`;
}

/**
 * Get agent prefix only (without content)
 */
export function getAgentPrefix(agent: AgentName): string {
    const info = AGENT_INFO[agent];
    return `${info.emoji} **[${info.name}]**`;
}

/**
 * Check if content has an agent prefix
 */
export function hasAgentPrefix(content: string): boolean {
    return /^[📋🎨🏗️⚙️👀⏭️🔍]\s*\*\*\[.*Agent\]\*\*/.test(content);
}

/**
 * Extract agent name from prefixed content
 */
export function extractAgentName(content: string): AgentName | null {
    const match = content.match(/^\S+\s*\*\*\[(.*?)\s*Agent\]\*\*/);
    if (!match) return null;

    const name = match[1].toLowerCase().replace(/\s+/g, '-');
    if (name.includes('product-development')) return 'product-dev';
    if (name.includes('product')) return 'product-design';
    if (name.includes('tech')) return 'tech-design';
    if (name.includes('implement')) return 'implementor';
    if (name.includes('review')) return 'pr-review';
    if (name.includes('auto')) return 'auto-advance';
    if (name.includes('bug-investigator') || name.includes('investigator')) return 'bug-investigator';

    return null;
}
