const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

let isRunning = false;
let pendingRun = false;

function runChecks() {
    if (isRunning) {
        pendingRun = true;
        return;
    }

    isRunning = true;
    console.clear();


    const process = spawn('yarn', ['checks'], {
        stdio: 'inherit',
        shell: true
    });

    process.on('close', (code) => {
        isRunning = false;

        if (code === 0) {
            console.log('✅ Checks passed');
        } else {
            console.log(`❌ Checks failed with code ${code}`);
        }

        if (pendingRun) {
            pendingRun = false;
            runChecks();
        }
    });
}

function watchDir(dir) {
    fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename) {
            console.log(`\n📁 File changed: ${filename}`);
            runChecks();
        }
    });
}

console.log(`👀 Watching ${srcDir} for changes...`);
watchDir(srcDir);
runChecks(); // Run checks initially 