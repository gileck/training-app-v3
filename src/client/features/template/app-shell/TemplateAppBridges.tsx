/**
 * TemplateAppBridges
 *
 * Aggregates every template feature that must mount at the app root *inside*
 * the router/auth context but renders no structural UI (so-called "bridges").
 * Rendered once by <AppShell>.
 *
 * Add future template app-root bridges here: because this file is template-owned
 * (synced via `src/client/features/template/**`) and is mounted by the
 * template-owned <AppShell>, child projects pick up new bridges automatically on
 * template sync — with no change to their project-owned `src/pages/_app.tsx`.
 *
 * Must be rendered inside <RouterProvider>: PushNavigationBridge uses useRouter().
 */
import type { ReactElement } from 'react';
import { PushNavigationBridge } from '../push-notifications';

export function TemplateAppBridges(): ReactElement {
    return (
        <>
            {/* Push deep-link navigation: SW `push-navigate` message -> router. */}
            <PushNavigationBridge />
            {/* Add future template app-root bridges below. */}
        </>
    );
}
