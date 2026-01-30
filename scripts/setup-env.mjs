import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const VENV_PATH = path.join(PROJECT_ROOT, '.venv');
const BOOTSTRAP_PYTHON = path.join(PROJECT_ROOT, '.bootstrap', 'python', 'python.exe');
const PYTHON_BRIDGE_PATH = path.join(PROJECT_ROOT, 'python-bridge');

console.log('🚀 Starting Hephasbot Environment Setup...');

function runCommand(command, args, cwd = PROJECT_ROOT) {
    return new Promise((resolve, reject) => {
        console.log(`> "${command}" ${args.join(' ')}`);

        // shell: false prevents Windows from trying to parse space-containing paths as arguments
        const proc = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            shell: false
        });

        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

async function setup() {
    try {
        let pythonExe = 'python';

        // 1. Check for bundled Python
        if (fs.existsSync(BOOTSTRAP_PYTHON)) {
            console.log(`🔌 Found bundled Python at ${BOOTSTRAP_PYTHON}`);
            pythonExe = BOOTSTRAP_PYTHON;
        } else {
            console.log('⚠️  No bundled Python found. Using system python.');
        }

        // 2. Check/Create .venv
        if (fs.existsSync(VENV_PATH)) {
            console.log('✅ Virtual environment already exists.');
        } else {
            console.log('📦 Creating virtual environment...');
            try {
                await runCommand(pythonExe, ['-m', 'venv', '.venv']);
            } catch (e) {
                if (pythonExe === 'python') {
                    console.log('⚠️  System python failed, trying python3...');
                    await runCommand('python3', ['-m', 'venv', '.venv']);
                } else {
                    throw e;
                }
            }
        }

        // 3. Install Dependencies
        const isWin = process.platform === 'win32';
        // Use pip inside the venv
        const pipPath = isWin
            ? path.join(VENV_PATH, 'Scripts', 'pip.exe')
            : path.join(VENV_PATH, 'bin', 'pip');

        console.log(`⬇️  Installing dependencies using ${pipPath}...`);

        if (!fs.existsSync(pipPath)) {
            console.warn(`Warning: pip not found at ${pipPath}. Attempting to lookup without .exe...`);
        }

        // Note: 'pipPath' might span spaces too, so shell: false is crucial here as well.
        // requirements.txt path also needs to be handled carefully, but runCommand splits args
        await runCommand(pipPath, ['install', '-r', path.join(PYTHON_BRIDGE_PATH, 'requirements.txt')]);

        console.log('🎉 Environment setup complete! Ready to Plug & Play.');
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

setup();
