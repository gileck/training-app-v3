import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Preview Auto-Login Middleware
 *
 * Automatically logs in a test user on Vercel preview deployments.
 * This allows testing preview URLs without manually entering credentials.
 *
 * Requirements:
 * - VERCEL_ENV must be 'preview'
 * - PREVIEW_USER_ID must be set to a valid user ID
 * - JWT_SECRET must be set
 *
 * Security: This ONLY works on preview deployments, never in production.
 */

const COOKIE_NAME = 'auth_token';

export async function middleware(request: NextRequest) {
    // Only run on Vercel preview deployments
    if (process.env.VERCEL_ENV !== 'preview') {
        return NextResponse.next();
    }

    // Check if PREVIEW_USER_ID is configured
    const previewUserId = process.env.PREVIEW_USER_ID;
    if (!previewUserId) {
        return NextResponse.next();
    }

    // Check if user already has auth cookie
    const existingToken = request.cookies.get(COOKIE_NAME);
    if (existingToken) {
        return NextResponse.next();
    }

    // Check JWT_SECRET is available
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('[Preview Auth] JWT_SECRET not set');
        return NextResponse.next();
    }

    try {
        // Generate JWT token for preview user
        // Using jose library which works in Edge runtime
        const { SignJWT } = await import('jose');

        const token = await new SignJWT({ userId: previewUserId })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('365d')
            .sign(new TextEncoder().encode(jwtSecret));

        // Create response and set cookie
        const response = NextResponse.next();
        response.cookies.set(COOKIE_NAME, token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 365 * 24 * 60 * 60, // 1 year
            path: '/',
        });

        console.log('[Preview Auth] Auto-logged in preview user:', previewUserId);
        return response;
    } catch (error) {
        console.error('[Preview Auth] Failed to generate token:', error);
        return NextResponse.next();
    }
}

// Only run middleware on page requests, not API or static files
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc.)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
    ],
};
