/**
 * Shared test boundary setup — configures DI singletons for E2E tests.
 *
 * Sets up:
 * 1. MongoMemoryServer → setMongoUri()
 * 2. MockProjectAdapter → setProjectManagementAdapter()
 * 3. MockGitAdapter → setGitAdapter()
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { setMongoUri, resetDbConnection } from '@/server/database/connection';
import { setProjectManagementAdapter, resetProjectManagementAdapter } from '@/server/project-management';
import { setGitAdapter, resetGitAdapter } from '@/agents/shared/git-adapter';
import { MockProjectAdapter } from '../mocks/mock-project-adapter';
import { MockGitAdapter } from '../mocks/mock-git-adapter';

export interface TestBoundaries {
    adapter: MockProjectAdapter;
    gitAdapter: MockGitAdapter;
    mongoServer: MongoMemoryServer;
}

let mongoServer: MongoMemoryServer | null = null;

export async function setupBoundaries(): Promise<TestBoundaries> {
    // 0. Set required env vars for project config (used by real config module)
    process.env.GITHUB_OWNER = 'test';
    process.env.GITHUB_REPO = 'repo';
    process.env.GITHUB_PROJECT_NUMBER = '1';

    // 1. Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    setMongoUri(uri);

    // 2. Inject MockProjectAdapter
    const adapter = new MockProjectAdapter();
    setProjectManagementAdapter(adapter);

    // 3. Inject MockGitAdapter
    const gitAdapter = new MockGitAdapter();
    setGitAdapter(gitAdapter);

    return { adapter, gitAdapter, mongoServer };
}

export async function teardownBoundaries(): Promise<void> {
    resetProjectManagementAdapter();
    resetGitAdapter();
    await resetDbConnection();
    if (mongoServer) {
        await mongoServer.stop();
        mongoServer = null;
    }
}
