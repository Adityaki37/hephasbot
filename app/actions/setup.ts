"use server";

import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function runSetupAction() {
    const scriptPath = path.resolve(process.cwd(), "scripts", "setup-env.mjs");

    return new Promise<{ success: boolean; logs: string[] }>((resolve) => {
        const logs: string[] = [];
        const command = "bun";

        try {
            const proc = spawn(command, ["run", scriptPath], {
                shell: true,
                cwd: process.cwd(),
                env: { ...process.env, FORCE_COLOR: "1" } // Ensure we get color output
            });

            proc.stdout.on("data", (data) => {
                const lines = data.toString().split("\n");
                lines.forEach((l: string) => {
                    if (l.trim()) logs.push(l.trim());
                });
            });

            proc.stderr.on("data", (data) => {
                const lines = data.toString().split("\n");
                lines.forEach((l: string) => {
                    if (l.trim()) logs.push(l.trim()); // Often info logs go to stderr
                });
            });

            proc.on("close", (code) => {
                if (code === 0) {
                    resolve({ success: true, logs });
                } else {
                    logs.push(`Process exited with code ${code}`);
                    resolve({ success: false, logs });
                }
            });

            proc.on("error", (err) => {
                logs.push(`Failed to start process: ${err.message}`);
                resolve({ success: false, logs });
            });

        } catch (e: any) {
            logs.push(`Exception: ${e.message}`);
            resolve({ success: false, logs });
        }
    });
}
