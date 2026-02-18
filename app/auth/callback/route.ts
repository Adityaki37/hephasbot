import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { workos, clientId, createSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

    try {
        const { user, accessToken } = await workos.userManagement.authenticateWithCode({
            code,
            clientId,
        });

        // Extract session ID from access token
        const claims = decodeJwt(accessToken);
        const sessionId = claims.sid as string | undefined;

        const session = await createSession(user, sessionId);
        const url = req.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.delete("code");

        const res = NextResponse.redirect(url);

        // Set cookie
        res.cookies.set("hephas_session", session, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/"
        });

        return res;
    } catch (error: any) {
        console.error("Auth Error:", error);
        return NextResponse.json({ error: error.message || "Authentication Failed" }, { status: 500 });
    }
}
