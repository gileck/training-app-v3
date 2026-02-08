import type {
    ProjectItem,
    CommonCLIOptions,
    ImplementationPhase,
} from '../../shared';

export interface ProcessableItem {
    item: ProjectItem;
    mode: 'new' | 'feedback' | 'clarification';
    prNumber?: number;
    /**
     * Branch name for feedback mode.
     * For feedback mode, this is retrieved FROM the open PR (not regenerated).
     * This is more reliable than regenerating because:
     * - Title could have changed
     * - Phase number could be wrong
     * - The PR itself knows its actual branch name
     */
    branchName?: string;
    /** Phase info for multi-PR workflow */
    phaseInfo?: {
        current: number;
        total: number;
        phases: ImplementationPhase[];
    };
}

export interface ImplementOptions extends CommonCLIOptions {
    skipPush?: boolean;
    skipPull?: boolean;
    skipLocalTest?: boolean;
}
