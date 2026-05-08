const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CURRENT_TOPIC_FILE = path.join(__dirname, 'src/data/current_topic.json');

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`[EXEC] ${command} ${args.join(' ')}`);
        const proc = spawn(command, args, {
            env: { ...process.env, ...options.env },
            ...options,
            shell: true
        });

        let output = "";
        proc.stdout.on('data', d => {
            output += d.toString();
            console.log(d.toString());
        });
        proc.stderr.on('data', d => {
            output += d.toString();
            console.error(d.toString());
        });

        proc.on('close', code => {
            if (code === 0) resolve();
            else {
                console.error(`FAILED: ${command} ${args.join(' ')} with code ${code}`);
                reject(new Error(`${command} failed. Output: ${output.slice(-500)}`));
            }
        });
    });
}

async function automateDay3() {
    console.log("--- 🤖 DAY 3 AUTOMATION STARTING ---");
    
    let devServer = null;
    try {
        // 1. Generate New Topic using AI
        console.log("\nStep 1: Generating AI Topic...");
        await runCommand('node', ['scripts/generate_topic.mjs'], { cwd: __dirname });

        // 2. Start Dev Server
        console.log("\nStep 2: Starting Dev Server...");
        devServer = spawn('npx', ['vite', '--port', '3003', '--host'], { 
            cwd: __dirname, 
            shell: true,
            detached: false 
        });

        // Wait for server to stabilize
        console.log("Waiting for server on port 3003...");
        try {
            execSync('npx wait-on http://localhost:3003 -t 30000');
        } catch (e) {
            console.log("wait-on failed, waiting 10s...");
            await new Promise(r => setTimeout(r, 10000));
        }

        // 3. Capture Video
        console.log("\nStep 3: Capturing Video...");
        try {
            await runCommand('node', ['capture_demo.js'], { cwd: __dirname });
            console.log("✅ Video Generation Success!");

            // 4. Publish to Social Media
            console.log("\nStep 4: Publishing to All Platforms...");
            try {
                await runCommand('python', ['scripts/unified_uploader.py', 'output_kreggscode.mp4'], { cwd: __dirname });
                console.log("✅ Publishing Success!");
            } catch (publishError) {
                console.error("❌ Publishing failed:", publishError.message);
            }

        } catch (captureError) {
            console.error("❌ Capture failed:", captureError.message);
        }

        console.log("\n--- ✅ DAY 3 AUTOMATION COMPLETE ---");

    } catch (error) {
        console.error("\n💥 Automation failed:", error.message);
        // Force exit on top-level error
        process.exit(1);
    } finally {
        // 5. Shutdown Server
        console.log("\nStep 5: Shutting down dev server...");

        if (process.platform === 'win32') {
            try {
                execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq npx*" /T', { stdio: 'ignore' });
            } catch (e) {}
        } else {
            // Linux/macOS: Be aggressive about killing anything on port 3003
            try {
                execSync('fuser -k 3003/tcp', { stdio: 'ignore' });
            } catch (e) {
                try {
                    execSync('lsof -ti:3003 | xargs kill -9', { stdio: 'ignore' });
                } catch (e2) {}
            }
        }
        
        if (devServer) {
            devServer.kill('SIGKILL');
        }

        // CRITICAL: Explicitly exit the process to prevent hanging in CI
        console.log("👋 Finalizing process...");
        setTimeout(() => process.exit(0), 1000);
    }
}

automateDay3();
