"use client";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import { UserProvider } from "@/components/user-session";
import { RobotProvider } from "@/components/robot-context";

export function Providers({ user, children }: { user: any, children: React.ReactNode }) {
    return (
        <UserProvider user={user}>
            <ConvexClientProvider>
                <RobotProvider>
                    {children}
                </RobotProvider>
            </ConvexClientProvider>
        </UserProvider>
    );
}
