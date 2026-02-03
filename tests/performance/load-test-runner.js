#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildServer } from '../../src/server.js'; // Adapted to use buildServer

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runLoadTest() {
    console.log('🚀 Starting load test suite...\n');

    // Start server
    const app = await buildServer();
    const port = process.env.PORT || 3001;
    const address = await app.listen({ port, host: '0.0.0.0' });

    console.log(`✅ Server started on ${address}`);

    try {
        // Run artillery tests
        const tests = [
            'register',
            'tracking',
            // 'workflows' // Disabled until implemented
        ];

        // Ensure directories exist
        const fs = await import('fs');
        if (!fs.existsSync('tests/results')) {
            fs.mkdirSync('tests/results', { recursive: true });
        }

        // Check availability of scripts/generate-test-data.js before running
        if (fs.existsSync('scripts/generate-test-data.js')) {
            console.log('Generating test data...');
            await execAsync('node scripts/generate-test-data.js');
        } else {
            console.warn('⚠️ scripts/generate-test-data.js not found, load tests might fail if they depend on CSVs.');
        }

        for (const test of tests) {
            console.log(`\n📊 Running ${test} load test...`);

            const { stdout, stderr } = await execAsync(
                `npx artillery run tests/load/${test}.yml --output tests/results/${test}-report.json`
            );

            console.log(stdout);
            if (stderr) console.error('Stderr:', stderr);

            // Generate HTML report
            await execAsync(
                `npx artillery report tests/results/${test}-report.json --output tests/results/${test}-report.html`
            );

            console.log(`✅ ${test} test completed. Report saved to tests/results/${test}-report.html`);
        }

        console.log('\n🎉 All load tests completed successfully!');
        console.log('📈 Reports available in tests/results/');

    } catch (error) {
        console.error('❌ Load test failed:', error);
        process.exit(1);
    } finally {
        await app.close();
        console.log('\n🛑 Server stopped');
    }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runLoadTest();
}

export { runLoadTest };
