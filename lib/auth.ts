import { WorkOS } from '@workos-inc/node';
import { SignJWT, jwtVerify } from 'jose';

type SessionUser = Record<string, unknown> & {
    sessionId?: string;
};

function getRequiredEnv(name: string) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing ${name} environment variable`);
    }
    return value;
}

const workosApiKey = getRequiredEnv("WORKOS_API_KEY");
const workosClientId = getRequiredEnv("WORKOS_CLIENT_ID");
const jwtSecretKey = getRequiredEnv("JWT_SECRET_KEY");

export const workos = new WorkOS(workosApiKey);
export const clientId = workosClientId;
const secret = new TextEncoder().encode(jwtSecretKey);

export async function createSession(user: SessionUser, sessionId?: string) {
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
        return payload.user as SessionUser;
    } catch {
        return null;
    }
}
