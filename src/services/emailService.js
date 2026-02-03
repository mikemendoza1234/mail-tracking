import { query } from '../db.js';
import config from '../config.js';

// Mock Nodemailer for now, but structured to easily swap
// In real prod, import nodemailer
const mockTransporter = {
    sendMail: async (opts) => {
        console.log(`[EmailProvider] Sending to ${opts.to}: ${opts.subject}`);
        return { messageId: 'mock-' + Date.now() };
    }
};

export const emailService = {
    /**
     * Send an email and track it
     */
    sendEmail: async ({ organizationId, contactId, email, subject, bodyHtml, workflowExecutionId }) => {
        try {
            // 1. Create email record in DB
            // We use 'draft' status initially
            const res = await query(
                `INSERT INTO emails (organization_id, contact_id, subject, body_html, status, workflow_execution_id)
                 VALUES ($1, $2, $3, $4, 'draft', $5)
                 RETURNING id`,
                [organizationId, contactId, subject, bodyHtml, workflowExecutionId]
            );
            const emailId = res.rows[0].id;

            // 2. Inject Tracking Pixel
            // Pixel URL: /o/:orgId/:emailId.png
            const pixelUrl = `${config.baseUrl || 'http://localhost:3000'}/o/${organizationId}/${emailId}.png`;
            const trackingHtml = `${bodyHtml}<br><img src="${pixelUrl}" width="1" height="1" style="display:none;" />`;

            // 3. Send using Provider
            await mockTransporter.sendMail({
                from: 'noreply@yourdomain.com',
                to: email,
                subject: subject,
                html: trackingHtml
            });

            // 4. Update status to sent
            await query(
                `UPDATE emails SET status = 'sent', sent_at = NOW(), tracking_pixel_url = $1 WHERE id = $2`,
                [pixelUrl, emailId]
            );

            return { emailId, status: 'sent' };
        } catch (error) {
            console.error('[EmailService] Failed to send email:', error);
            // Log error in DB?
            throw error;
        }
    }
};
