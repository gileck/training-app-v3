export interface SwRegistrationInfo {
    supported: boolean;
    registered: boolean;
    scope?: string;
    scriptURL?: string;
    state?: string;
    isControlling: boolean;
    updateViaCache?: string;
    waitingScriptURL?: string;
    installingScriptURL?: string;
    pushManagerSupported: boolean;
}

export interface PushSubscriptionInfo {
    subscribed: boolean;
    endpoint?: string;
    expirationTime?: number | null;
    keysPresent: boolean;
}

export interface PermissionInfo {
    notificationSupported: boolean;
    permission: NotificationPermission | 'unsupported';
    pushApiSupported: boolean;
    secureContext: boolean;
}

export interface PlatformInfo {
    userAgent: string;
    platform: string;
    isStandalone: boolean;
    isIos: boolean;
    isIosPwaEligible: boolean;
    iosVersion?: string;
    maxTouchPoints?: number;
}

export interface SwAssetInfo {
    swPushReachable: boolean | null;
    swPushStatus?: number;
    swJsReachable: boolean | null;
    swJsStatus?: number;
}

export interface ServerInfo {
    configured: boolean | null;
    subscribed: boolean | null;
    endpoints: number | null;
    error?: string;
}

export interface Diagnostics {
    capturedAt: string;
    sw: SwRegistrationInfo;
    push: PushSubscriptionInfo;
    permission: PermissionInfo;
    platform: PlatformInfo;
    assets: SwAssetInfo;
    server: ServerInfo;
    vapidPublicKeyConfigured: boolean;
}
