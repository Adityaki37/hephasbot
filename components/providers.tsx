"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
// import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { RobotProvider } from "@/components/robot-context";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ConvexProvider client={convex}>
            <RobotProvider>
                {children}
            </RobotProvider>
        </ConvexProvider>
    );
}
