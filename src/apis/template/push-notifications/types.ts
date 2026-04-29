import type { PushPlatform } from '@/server/database/collections/template/push-subscriptions/types';

export type { PushPlatform };

export interface PushKeys {
    p256dh: string;
    auth: string;
}

export interface SubscribeRequest {
    endpoint: string;
    keys: PushKeys;
    platform: PushPlatform;
    userAgent?: string;
}

export interface SubscribeResponse {
    success?: boolean;
    error?: string;
}

export interface UnsubscribeRequest {
    endpoint: string;
}

export interface UnsubscribeResponse {
    success?: boolean;
    error?: string;
}

export type GetStatusRequest = Record<string, never>;

export interface GetStatusResponse {
    subscribed?: boolean;
    endpoints?: number;
    configured?: boolean;
    error?: string;
}

export interface SendTestRequest {
    title?: string;
    body?: string;
    url?: string;
}

export interface SendTestResponse {
    success?: boolean;
    sent?: number;
    removed?: number;
    error?: string;
}

export interface SendTestToUserRequest {
    userId: string;
    title?: string;
    body?: string;
    url?: string;
}

export interface SendTestToUserResponse {
    success?: boolean;
    sent?: number;
    removed?: number;
    error?: string;
}
