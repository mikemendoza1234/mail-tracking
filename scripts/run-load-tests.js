import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Running all load tests...\n');

const tests = [
    { name: 'register', file: 'tests/load/register.yml' },
    { name: 'tracking', file: 'tests/load/tracking.yml' }
];

try {
    for (const test of tests) {
        console.log(`📊 Running ${test.name} load test...`);

        const command = `npx artillery run ${test.file} --output tests/results/${test.name}-report.json`;
        console.log(`Command: ${command}`);

        execSync(command, { stdio: 'inherit' });

        // Generate HTML report
        const reportCommand = `npx artillery report tests/results/${test.name}-report.json --output tests/results/${test.name}-report.html`;
        execSync(reportCommand, { stdio: 'inherit' });

        console.log(`✅ ${test.name} test completed. Report saved to tests/results/${test.name}-report.html\n`);
    }

    console.log('🎉 All load tests completed successfully!');
    console.log('📈 Reports available in tests/results/');

} catch (error) {
    console.error('❌ Load test failed:', error.message);
    process.exit(1);
}
