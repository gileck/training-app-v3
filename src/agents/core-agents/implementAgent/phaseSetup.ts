import {
    getProjectManagementAdapter,
    type ImplementationPhase,
    type GitHubComment,
} from '../../shared';
import {
    extractPhasesFromTechDesign,
    parsePhaseString,
} from '../../lib/parsing';
import {
    parsePhasesFromComment,
} from '../../lib/phases';
import {
    getTaskBranch,
    generateTaskBranchName,
    setTaskBranch,
    type ArtifactComment,
} from '../../lib/artifacts';
import { getPhasesFromDB, saveTaskBranchToDB } from '../../lib/workflow-db';
import {
    logFeatureBranch,
} from '../../lib/logging';
import type { ProcessableItem, ImplementOptions } from './types';
import { ensureFeatureBranch } from './gitUtils';

export interface PhaseResolution {
    currentPhase: number | undefined;
    totalPhases: number | undefined;
    currentPhaseDetails: ImplementationPhase | undefined;
    phaseInfo: ProcessableItem['phaseInfo'];
    taskBranchForPhase: string | null;
}

/**
 * Resolve phase information for the current item.
 * Handles: checking for existing phases in DB/comments/markdown,
 * detecting multi-phase from tech design, initializing phase tracking,
 * resolving task branch for continuing phases.
 */
export async function resolvePhaseInfo(
    processable: ProcessableItem,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    issueNumber: number,
    issueComments: GitHubComment[],
    techDesign: string | null,
    artifact: ArtifactComment | null,
    defaultBranch: string,
    options: ImplementOptions,
): Promise<PhaseResolution> {
    const { mode } = processable;
    let phaseInfo = processable.phaseInfo;
    let currentPhase: number | undefined;
    let totalPhases: number | undefined;
    let currentPhaseDetails: ImplementationPhase | undefined;

    // First, check if phase tracking already exists in GitHub project
    const existingPhase = await adapter.getImplementationPhase(processable.item.id);
    const parsed = parsePhaseString(existingPhase);

    // Track task branch for multi-phase workflow
    let taskBranchForPhase: string | null = null;

    if (parsed) {
        // Phase tracking exists - use it for all modes
        currentPhase = parsed.current;
        totalPhases = parsed.total;
        const multiPhaseMsg = `Multi-phase feature: Phase ${currentPhase}/${totalPhases}`;
        console.log(`  🌿 ${multiPhaseMsg}`);
        logFeatureBranch(issueNumber, multiPhaseMsg);

        // Try to get phase details from DB first, then comments, then markdown
        const parsedPhases = await getPhasesFromDB(issueNumber) ||
                             parsePhasesFromComment(issueComments) ||
                             (techDesign ? extractPhasesFromTechDesign(techDesign) : null);
        if (parsedPhases) {
            currentPhaseDetails = parsedPhases.find(p => p.order === currentPhase);
            phaseInfo = {
                current: currentPhase,
                total: totalPhases,
                phases: parsedPhases,
            };
            console.log('  Phases loaded');
        }

        // Get task branch from artifact for continuing phases (Phase 2+)
        if (mode === 'new' && currentPhase > 1) {
            taskBranchForPhase = getTaskBranch(artifact);
            if (taskBranchForPhase) {
                const retrievedMsg = `Retrieved task branch from artifact: ${taskBranchForPhase}`;
                console.log(`  🌿 ${retrievedMsg}`);
                logFeatureBranch(issueNumber, retrievedMsg);
            } else {
                console.warn(`  ⚠️ Task branch not found in artifact for Phase ${currentPhase}/${totalPhases}`);
                console.warn(`  Expected: Task branch should have been set in Phase 1`);
                logFeatureBranch(issueNumber, `WARNING: Task branch not found in artifact for Phase ${currentPhase}/${totalPhases}`);
                // Fallback: try to generate the expected branch name
                taskBranchForPhase = generateTaskBranchName(issueNumber);
                const fallbackMsg = `Using generated task branch name: ${taskBranchForPhase}`;
                console.log(`  🌿 ${fallbackMsg}`);
                logFeatureBranch(issueNumber, fallbackMsg);
            }
        }
    } else if (mode === 'new' && !phaseInfo) {
        // No existing phase - check if we should start multi-phase (only for new implementations)
        // Try DB first, then comment, then markdown
        const parsedPhases = await getPhasesFromDB(issueNumber) ||
                             parsePhasesFromComment(issueComments) ||
                             (techDesign ? extractPhasesFromTechDesign(techDesign) : null);

        if (parsedPhases && parsedPhases.length >= 2) {
            // Start new multi-phase implementation
            currentPhase = 1;
            totalPhases = parsedPhases.length;
            const detectedMsg = `Detected multi-phase feature: ${totalPhases} phases`;
            console.log(`  🌿 ${detectedMsg}`);
            logFeatureBranch(issueNumber, detectedMsg);
            console.log('  Phases loaded');

            // Set phase tracking in GitHub project
            if (!options.dryRun && adapter.hasImplementationPhaseField()) {
                await adapter.setImplementationPhase(processable.item.id, `${currentPhase}/${totalPhases}`);
                console.log(`  Set Implementation Phase to: ${currentPhase}/${totalPhases}`);
            }

            // Create feature branch for multi-phase workflow
            if (!options.dryRun) {
                const taskBranchName = await ensureFeatureBranch(adapter, issueNumber, defaultBranch);
                // Store task branch in DB + artifact comment for future phases to reference
                await saveTaskBranchToDB(issueNumber, taskBranchName);
                await setTaskBranch(adapter, issueNumber, taskBranchName);
                const storedMsg = `Feature branch stored in artifact: ${taskBranchName}`;
                console.log(`  🌿 ${storedMsg}`);
                logFeatureBranch(issueNumber, storedMsg);
            }

            // Get current phase details
            currentPhaseDetails = parsedPhases.find(p => p.order === currentPhase);
            phaseInfo = {
                current: currentPhase,
                total: totalPhases,
                phases: parsedPhases,
            };
        }
    } else if (phaseInfo) {
        // Phase info passed in (from previous processing)
        currentPhase = phaseInfo.current;
        totalPhases = phaseInfo.total;
        currentPhaseDetails = phaseInfo.phases.find(p => p.order === currentPhase);
        console.log(`  📋 Continuing phase ${currentPhase}/${totalPhases}`);
    }

    return {
        currentPhase,
        totalPhases,
        currentPhaseDetails,
        phaseInfo,
        taskBranchForPhase,
    };
}
