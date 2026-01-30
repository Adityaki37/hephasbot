import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const VENV_PATH = path.join(PROJECT_ROOT, '.venv');
const BOOTSTRAP_PYTHON = path.join(PROJECT_ROOT, '.bootstrap', 'python', 'python.exe');
const BRIDGE_SCRIPT = path.join(PROJECT_ROOT, 'python-bridge', 'server.py');

console.log('🚀 Starting Hephasbot Python Bridge...');

function runCommand(command, args, cwd = PROJECT_ROOT) {
    return new Promise((resolve, reject) => {
        console.log(`> "${command}" ${args.join(' ')}`);

        // shell: false to avoid space issues
        const proc = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            shell: false
        });

        proc.on('close', (code) => {
            console.log(`Bridge exited with code ${code}`);
            resolve();
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

async function start() {
    try {
        let pythonExe = 'python';

        // 1. Determine Python path (prioritize bundled -> venv -> system)
        // Actually, we should use the venv python if set up
        const isWin = process.platform === 'win32';
        const venvPython = isWin
            ? path.join(VENV_PATH, 'Scripts', 'python.exe')
            : path.join(VENV_PATH, 'bin', 'python');

        if (fs.existsSync(venvPython)) {
            console.log(`Using VirtualEnv Python: ${venvPython}`);
            pythonExe = venvPython;
        } else if (fs.existsSync(BOOTSTRAP_PYTHON)) {
            console.log(`Using Bootstrapped Python (No venv?): ${BOOTSTRAP_PYTHON}`);
            pythonExe = BOOTSTRAP_PYTHON;
        } else {
            console.log('Using System Python');
        }

        // 2. Run Server
        // uvicorn or python file? server.py runs uvicorn manually in __main__
        await runCommand(pythonExe, [BRIDGE_SCRIPT]);

    } catch (error) {
        console.error('❌ Bridge failed:', error);
        process.exit(1);
    }
}

start();
