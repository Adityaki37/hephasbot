"use client";

import { useState } from "react";
import { Download, CheckCircle, AlertCircle, Terminal, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { runSetupAction } from "@/app/actions/setup";

// Mock stages for the setup process
const STAGES = [
    { id: "check", label: "Check System Requirements", icon: CheckCircle },
    { id: "venv", label: "Create Isolated Environment", icon: Terminal },
    { id: "install", label: "Install LeRobot & AI Engine", icon: Download },
    { id: "verify", label: "Verify Robot Connection", icon: Play },
];

export default function SetupPage() {
    const [currentStage, setCurrentStage] = useState(0);
    const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
    const [logs, setLogs] = useState<string[]>([]);
    const { user } = useAuth();

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const startSetup = async () => {
        setStatus("running");
        setLogs([]);
        setCurrentStage(1);

        addLog("Initiating Setup Action...");
        addLog("Requesting environment creation (this may take a few minutes)...");

        // Simulate UI progress for Stage 1 & 2 while we wait for the server
        // Since the actual script will be fast (or fail fast), this minimal delay is just for UX smoothing
        const uiTimer = setTimeout(() => setCurrentStage(2), 2000);

        try {
            const result = await runSetupAction();
            clearTimeout(uiTimer); // Clear manual timer, rely on result

            // Append real logs from server
            setLogs(prev => [...prev, "--- SERVER LOGS ---", ...result.logs]);

            if (result.success) {
                setCurrentStage(4); // Jump to end
                setStatus("success");
                addLog("Setup completed successfully!");
            } else {
                // Environment failure (expected if python is missing)
                setStatus("error");
                addLog("Setup failed. Please check the logs above.");
                addLog("If 'python' is missing, please install Python 3.10+ on your host machine.");
            }
        } catch (e) {
            setStatus("error");
            addLog("Network/Server Error occurred.");
            console.error(e);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-12">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold tracking-tight mb-4">Environment Setup</h1>
                <p className="text-muted-foreground">
                    Initialize the Hephasbot AI Engine on your local machine. <br />
                    This is a one-time process to enable "Plug & Play" robot control.
                </p>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
                {/* Progress Header */}
                <div className="bg-muted/30 p-6 border-b border-border flex justify-between items-center">
                    <div className="flex gap-2">
                        {STAGES.map((stage, i) => (
                            <div key={stage.id} className={cn(
                                "w-3 h-3 rounded-full transition-colors",
                                i <= currentStage ? "bg-primary" : "bg-muted-foreground/30",
                                i === currentStage && status === "running" && "animate-pulse"
                            )} />
                        ))}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                        v1.0.0
                    </div>
                </div>

                {/* Main Content */}
                <div className="p-8 space-y-8">
                    {status === "idle" && (
                        <div className="flex flex-col items-center py-8">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
                                <Download className="w-10 h-10" />
                            </div>
                            <button
                                onClick={startSetup}
                                className="px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-full hover:scale-105 transition-transform shadow-lg shadow-primary/25"
                            >
                                Start Installation
                            </button>
                            <p className="text-xs text-muted-foreground mt-4">Requires ~2GB of space. Python 3.10+ recommended.</p>
                        </div>
                    )}

                    {(status === "running" || status === "success" || status === "error") && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="space-y-6 mb-8">
                                {STAGES.map((stage, i) => {
                                    const isCompleted = i < currentStage || status === "success";
                                    const isCurrent = i === currentStage && status === "running";

                                    return (
                                        <div key={stage.id} className={cn("flex items-center gap-4",
                                            (isCompleted || isCurrent) ? "opacity-100" : "opacity-30"
                                        )}>
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center border transition-colors",
                                                isCompleted ? "bg-green-500/20 border-green-500 text-green-500" :
                                                    isCurrent ? "bg-blue-500/20 border-blue-500 text-blue-500" :
                                                        "bg-muted border-transparent"
                                            )}>
                                                {isCompleted ? <CheckCircle className="w-5 h-5" /> :
                                                    isCurrent ? <stage.icon className="w-5 h-5 animate-pulse" /> :
                                                        <stage.icon className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h4 className="font-medium">{stage.label}</h4>
                                                {isCurrent && <span className="text-xs text-blue-500 animate-pulse">Processing...</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Terminal Output */}
                            <div className="bg-black/80 rounded-lg p-4 font-mono text-xs text-green-400 h-64 overflow-y-auto border border-white/10 shadow-inner custom-scrollbar">
                                <div className="opacity-50 mb-2">root@hephasbot:~/setup# ./install.sh</div>
                                {logs.map((log, i) => (
                                    <div key={i} className="mb-1 whitespace-pre-wrap">{log}</div>
                                ))}
                                {status === "running" && <div className="animate-pulse">_</div>}
                            </div>

                            {status === "success" && (
                                <div className="mt-6 flex justify-center">
                                    <a href="/dashboard" className="px-8 py-3 bg-green-600 text-white font-semibold rounded-full hover:bg-green-500 transition-colors shadow-lg shadow-green-900/20">
                                        Complete & Go to Dashboard
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
