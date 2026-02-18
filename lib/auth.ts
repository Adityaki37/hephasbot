import { WorkOS } from '@workos-inc/node';
import { SignJWT, jwtVerify } from 'jose';

if (!process.env.WORKOS_API_KEY || !process.env.WORKOS_CLIENT_ID) {
    throw new Error("Missing WORKOS_API_KEY or WORKOS_CLIENT_ID environment variables");
}

export const workos = new WorkOS(process.env.WORKOS_API_KEY);
export const clientId = process.env.WORKOS_CLIENT_ID;

// Use a fallback secret for dev if not provided (DO NOT USE IN PROD)
const secretKey = process.env.JWT_SECRET_KEY || "new_rotated_secret_key_" + new Date().getFullYear();
const secret = new TextEncoder().encode(secretKey);

export async function createSession(user: any, sessionId?: string) {
    // Attach sessionId to user object for easy retrieval
    if (sessionId) {
        user.sessionId = sessionId;
    }
    const token = await new SignJWT({ user })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);
    return token;
}

export async function getSession(token: string) {
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload.user;
    } catch (e) {
        return null;
    }
}
