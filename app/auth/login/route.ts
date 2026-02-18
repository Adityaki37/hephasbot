import { NextRequest, NextResponse } from "next/server";
import { workos, clientId } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const authUrl = workos.userManagement.getAuthorizationUrl({
        clientId,
        provider: "authkit",
        prompt: "login",
        redirectUri: `${req.nextUrl.origin}/auth/callback`,
    });

    return NextResponse.redirect(authUrl);
}
