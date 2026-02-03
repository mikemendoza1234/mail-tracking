import http from 'http';

async function request(path, method = 'GET', body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    console.log('Testing Authentication...');

    const email = `test-${Date.now()}@example.com`;

    // 1. Register
    console.log('1. Registering Organization...');
    const regRes = await request('/api/auth/register', 'POST', {
        orgName: 'Acme Corp',
        domain: 'acme.com',
        email,
        password: 'password123'
    });

    if (regRes.status !== 200) {
        console.error('Registration failed:', regRes.body);
        process.exit(1);
    }
    const { token, user } = regRes.body;
    console.log('   Success! Token:', token.substring(0, 20) + '...');

    // 2. Access Protected Route (Contacts)
    console.log('2. Accessing Protected Route...');
    const contactsRes = await request('/api/contacts', 'GET', null, token);

    if (contactsRes.status !== 200) {
        console.error('Protected access failed:', contactsRes.body);
        process.exit(1);
    }
    console.log('   Success! Contacts:', contactsRes.body.length);

    // 3. Create Contact
    console.log('3. Creating Contact...');
    const contactRes = await request('/api/contacts', 'POST', {
        email: 'visitor@example.com',
        firstName: 'John',
        lastName: 'Doe'
    }, token);

    if (contactRes.status !== 200) {
        console.error('Create contact failed:', contactRes.body);
        process.exit(1);
    }
    console.log('   Success! Contact ID:', contactRes.body.id);

    console.log('Auth Flow Verified.');
}

run();
