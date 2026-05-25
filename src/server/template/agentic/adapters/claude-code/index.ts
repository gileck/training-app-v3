/**
 * Claude Code adapter — public surface.
 *
 * `init(config)` returns a configured `AgenticAdapter` instance ready
 * to drop into `createAgentHandler`'s `adapters` list. The adapter
 * class itself stays internal so the folder can split into multiple
 * files (message translation, native-tool tracking, etc.) without
 * leaking implementation details.
 */

import type { AgenticAdapter, AgenticAdapterConfig } from '../../types';
import { ClaudeCodeAgenticAdapter } from './adapter';

export function init(config: AgenticAdapterConfig): AgenticAdapter {
    return new ClaudeCodeAgenticAdapter(config);
}
