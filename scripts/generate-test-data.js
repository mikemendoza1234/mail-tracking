import fs from 'fs';
import { faker } from '@faker-js/faker';

const COUNT = 1000;
const OUT_FILE = 'tests/data/organizations.csv';

// Ensure dir
if (!fs.existsSync('tests/data')) {
    fs.mkdirSync('tests/data', { recursive: true });
}

console.log(`Generating ${COUNT} records to ${OUT_FILE}...`);

const stream = fs.createWriteStream(OUT_FILE);
stream.write('name,email,password\n');

for (let i = 0; i < COUNT; i++) {
    const name = faker.company.name().replace(/,/g, ''); // Remove commas
    const email = faker.internet.email();
    const password = 'password123';
    stream.write(`${name},${email},${password}\n`);
}

stream.end();
console.log('Done.');
