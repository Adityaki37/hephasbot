"use client";

import { TerminalView } from "@/components/terminal-view";

export default function TerminalPage() {
    return (
        <div className="h-full flex flex-col space-y-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Terminal</h1>
                <p className="text-muted-foreground">Direct access to the underlying robot environment.</p>
            </div>

            <div className="flex-1 min-h-[600px]">
                <TerminalView />
            </div>
        </div>
    );
}
