import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
const envPath = join(__dirname, '..', '.env.test');
dotenv.config({ path: envPath });

// Configure for Windows
if (process.platform === 'win32') {
    // Ensure test environment variables are loaded
    process.env.NODE_ENV = 'test';

    // Longer timeout for Windows
    jest.setTimeout(30000);
}

// Mock de console para tests
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
};

console.log = (...args) => {
    if (process.env.VERBOSE_TESTS === 'true') {
        originalConsole.log(...args);
    }
};

console.error = (...args) => {
    originalConsole.error(...args);
};

console.warn = (...args) => {
    originalConsole.warn(...args);
};

// Limpiar mocks después de cada test
afterEach(() => {
    jest.clearAllMocks();
});
