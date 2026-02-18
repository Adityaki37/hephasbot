import { NextRequest, NextResponse } from "next/server";
import { getSession, workos } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const sessionToken = req.cookies.get("hephas_session")?.value;
    const session = sessionToken ? await getSession(sessionToken) as any : null;

    if (session?.sessionId) {
        try {
            const logoutUrl = workos.userManagement.getLogoutUrl({
                sessionId: session.sessionId,
                returnTo: req.nextUrl.origin,
            });

            const res = NextResponse.redirect(logoutUrl);
            res.cookies.delete("hephas_session");
            return res;
        } catch (error) {
            console.error("WorkOS logout error:", error);
        }
    }

    const url = req.nextUrl.clone();
    url.pathname = "/";

    const res = NextResponse.redirect(url);
    res.cookies.delete("hephas_session");
    return res;
}
