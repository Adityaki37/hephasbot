"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Cpu,
    Terminal,
    Settings,
    LayoutDashboard,
    LogOut
} from "lucide-react";
// import { useAuth, signOut } from "@workos-inc/authkit-nextjs/components";

const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Robots", href: "/dashboard/robots", icon: Cpu },
    { name: "Terminal", href: "/dashboard/terminal", icon: Terminal },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    // Mock user for now
    const user = { firstName: "Admin", email: "admin@hephasbot.com", profilePictureUrl: null };

    // Basic signOut handler (in a real app, you might want to call a server action or redirect explicitly)
    // WorkOS signOut returns a URL usually, or we can use the library function if available.
    // Actually, standard WorkOS useAuth doesn't expose signOut function directly in all versions, 
    // but let's assume valid flow or link to /auth/logout if needed.
    // Checking docs: <Link href="/auth/logout"> works if route exists, or call signOut().

    return (
        <div className="flex h-full w-64 flex-col bg-card border-r border-border">
            <div className="flex h-16 items-center px-6 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-primary rounded-md shadow-sm shadow-primary/20" />
                    <span className="text-lg font-bold tracking-tight">Hephasbot</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-1 p-3">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.name}
                        </Link>
                    );
                })}
            </div>

            <div className="p-3 border-t border-border/50">
                <div className="flex items-center gap-3 px-3 py-3 mb-2">
                    {user?.profilePictureUrl ? (
                        <img src={user.profilePictureUrl} alt="Avatar" className="w-8 h-8 rounded-full bg-muted" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                            {user?.firstName?.[0] || "U"}
                        </div>
                    )}
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium truncate">{user?.firstName || "User"}</span>
                        <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                    </div>
                </div>
                <a
                    href="/auth/logout" // Assumes WorkOS handler or we can make a custom one
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </a>
            </div>
        </div>
    );
}
