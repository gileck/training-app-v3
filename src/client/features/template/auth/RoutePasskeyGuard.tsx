/**
 * RoutePasskeyGuard
 *
 * Bridges the router's `requirePasskey` route option to <PasskeyGuard>. Rendered
 * once around the active route component (in _app.tsx). When the current route
 * declares `requirePasskey`, the page is gated behind a fresh passkey assertion;
 * otherwise children render untouched.
 *
 * Lives in the auth feature (not the router) so the router never imports auth
 * UI — it only exposes the resolved guard config via context.
 */

import { useRouter } from '../router';
import { PasskeyGuard } from './PasskeyGuard';

export function RoutePasskeyGuard({ children }: { children: React.ReactNode }) {
    const { routePasskeyGuard } = useRouter();

    if (!routePasskeyGuard) {
        return <>{children}</>;
    }

    const { guardKey, config } = routePasskeyGuard;
    return (
        <PasskeyGuard
            guardKey={guardKey}
            ttlMs={config.ttlMs}
            title={config.title}
            description={config.description}
        >
            {children}
        </PasskeyGuard>
    );
}
