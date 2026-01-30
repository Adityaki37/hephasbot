"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { useMeasure } from "react-use-measure";

export function TerminalView() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const [ref, bounds] = useMeasure();
    const fitAddonRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: "#09090b", // zinc-950
                foreground: "#f4f4f5", // zinc-100
                cursor: "#22c55e",     // green-500
            },
            fontFamily: "Menlo, Monaco, 'Courier New', monospace",
            fontSize: 14,
            allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        fitAddonRef.current = fitAddon;

        term.open(terminalRef.current);
        fitAddon.fit();

        term.writeln("\x1b[32mTarget System:\x1b[0m Hephasbot Environment");
        term.writeln("\x1b[34mStatus:\x1b[0m \x1b[1mConnected\x1b[0m");
        term.writeln("");
        term.writeln("Welcome to the Hephasbot Integrated Terminal.");
        term.writeln("Type 'help' for a list of commands.");
        term.writeln("");
        term.write("$ ");

        xtermRef.current = term;

        // Simple local echo for demo
        term.onData((data) => {
            const char = data;
            // Handle backspace
            if (char === "\r") {
                term.write("\r\n$ ");
            } else if (char === "\u007F") {
                term.write("\b \b");
            } else {
                term.write(char);
            }
        });

        return () => {
            term.dispose();
        };
    }, []);

    // Handle resize
    useEffect(() => {
        if (fitAddonRef.current) {
            fitAddonRef.current.fit();
        }
    }, [bounds]);

    return (
        <div className="w-full h-full min-h-[500px] rounded-lg border border-border bg-[#09090b] p-4 font-mono shadow-inner overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2 opacity-50 text-xs">
                <span>bash — 80x24</span>
                <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500/50" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                    <div className="w-2 h-2 rounded-full bg-green-500/50" />
                </div>
            </div>
            <div ref={ref} className="flex-1 w-full h-full relative">
                <div ref={terminalRef} className="absolute inset-0" />
            </div>
        </div>
    );
}
