#!/usr/bin/env node
import axios from 'axios';

const API_URL = 'http://localhost:3000';

async function testWorkflow() {
    console.log('🧪 Testing Workflow System\n');

    try {
        // 1. Register
        console.log('1. Registering organization...');
        // Unique email to avoid conflict
        const testEmail = `workflow_test_${Date.now()}@test.com`;
        const registerRes = await axios.post(`${API_URL}/api/auth/register`, {
            orgName: 'Workflow Test',
            email: testEmail,
            password: 'test123'
        });

        const token = registerRes.data.token;
        console.log(`   ✅ Registered, token: ${token.substring(0, 20)}...`);

        // 2. Create contact
        console.log('\n2. Creating contact...');
        const contactRes = await axios.post(`${API_URL}/api/contacts`, {
            email: `contact_${Date.now()}@test.com`,
            firstName: 'Workflow',
            lastName: 'Test'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const contactId = contactRes.data.id;
        console.log(`   ✅ Contact created: ${contactId}`);

        // 3. Create workflow
        console.log('\n3. Creating workflow...');
        const workflowRes = await axios.post(`${API_URL}/api/workflows`, {
            name: 'Test Workflow',
            triggerType: 'manual',
            nodes: [
                {
                    id: 'email_1',
                    type: 'email',
                    config: {
                        subject: 'Test Workflow Email',
                        body: 'This is a test email from the workflow system.',
                        wait_days: 0
                    }
                },
                {
                    id: 'wait_1',
                    type: 'wait',
                    config: { days: 0 }
                },
                {
                    id: 'email_2',
                    type: 'email',
                    config: {
                        subject: 'Follow-up Email',
                        body: 'This is a follow-up email.',
                        wait_days: 0
                    }
                }
            ]
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const workflowId = workflowRes.data.id;
        console.log(`   ✅ Workflow created: ${workflowId}`);

        // 4. Trigger workflow
        console.log('\n4. Triggering workflow...');
        const triggerRes = await axios.post(
            `${API_URL}/api/workflows/${workflowId}/trigger`,
            {
                contactId: contactId,
                data: { test: true }
            },
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        const executionId = triggerRes.data.executionId || triggerRes.data.execution?.id;
        console.log(`   ✅ Workflow triggered: ${executionId || 'No execution ID returned'}`);

        // 5. Wait for processing
        console.log('\n5. Waiting for processing... (15 seconds)');
        await new Promise(resolve => setTimeout(resolve, 15000));

        // 6. Try to check emails if endpoint exists
        console.log('\n6. Checking results...');
        try {
            const emailsRes = await axios.get(`${API_URL}/api/emails`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(`   ✅ Emails in system: ${emailsRes.data?.length || 0}`);
        } catch (emailError) {
            console.log('   ⚠️ Email endpoint not available or error:', emailError.message);
        }

        // 7. Check execution status
        console.log('\n7. Checking execution status...');
        try {
            // Try to get workflow executions if endpoint exists
            const execRes = await axios.get(
                `${API_URL}/api/workflows/${workflowId}/executions`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log(`   ✅ Executions found: ${execRes.data?.length || 0}`);
        } catch (execError) {
            console.log('   ⚠️ Executions endpoint not available');
        }

        console.log('\n🎉 Workflow test completed!');
        console.log('\n📋 Next steps:');
        console.log('   1. Check worker logs for processing details');
        console.log('   2. Verify emails were sent (check logs or inbox)');
        console.log('   3. Test tracking pixel if emails were created');

    } catch (error) {
        console.error('\n❌ Workflow test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

testWorkflow();
