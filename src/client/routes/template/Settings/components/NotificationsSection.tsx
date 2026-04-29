/**
 * Notifications Section
 *
 * Wraps the PushNotificationToggle for use inside the Settings page.
 */

import { PushNotificationToggle } from '@/client/features/template/push-notifications';

export function NotificationsSection() {
    return (
        <section aria-labelledby="notifications-section-heading">
            <h2
                id="notifications-section-heading"
                className="mb-3 text-sm font-semibold text-muted-foreground"
            >
                Notifications
            </h2>
            <PushNotificationToggle />
        </section>
    );
}
