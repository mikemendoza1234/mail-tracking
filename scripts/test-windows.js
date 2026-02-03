#!/usr/bin/env node

import { execSync, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Windows Test Runner\n');

// Check dependencies
console.log('Checking dependencies...');
try {
    execSync('node --version', { stdio: 'pipe' });
    console.log('✅ Node.js installed');
} catch {
    console.error('❌ Node.js not found');
    process.exit(1);
}

// Run setup if .env.test doesn't exist
const envTestPath = join(__dirname, '..', '.env.test');
if (!fs.existsSync(envTestPath)) {
    console.log('Running test setup...');
    execSync('node scripts/test-setup.js', { stdio: 'inherit' });
}

// Run tests
console.log('\n🚀 Running tests...\n');

try {
    // Unit tests
    const unitTestDir = join(__dirname, '..', 'tests', 'unit');
    if (fs.existsSync(unitTestDir)) {
        console.log('1. Running unit tests...');
        execSync('node --experimental-vm-modules --env-file=.env.test node_modules/jest/bin/jest.js tests/unit/', { stdio: 'inherit' });
    } else {
        console.log('1. Skipping unit tests (directory not found)');
    }

    // Integration tests
    console.log('\n2. Running integration tests...');
    execSync('node --experimental-vm-modules --env-file=.env.test node_modules/jest/bin/jest.js tests/integration/ --runInBand', { stdio: 'inherit' });

    // Start server for load tests
    console.log('\n3. Starting server for load tests...');
    const serverProcess = exec('node --env-file=.env src/index.js');

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Run load tests
    console.log('\n4. Running load tests...');
    execSync('node scripts/run-load-tests.js', { stdio: 'inherit' });

    // Stop server
    serverProcess.kill();

    console.log('\n🎉 All tests completed successfully!');

} catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
}
