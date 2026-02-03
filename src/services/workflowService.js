import { query } from '../db.js';

export const workflowService = {
    /**
     * Evaluate a condition node against tracking events
     */
    evaluateCondition: async (organizationId, contactId, config) => {
        const { condition, timeframe_hours } = config;

        // Example: "email_opened"
        if (condition === 'email_opened') {
            // Check if ANY email sent to this contact in this workflow context was opened?
            // Or specific email? Usually config.email_node_id needed.
            // Simplified: check any event for this contact in last X hours

            let timeFilter = '';
            if (timeframe_hours) {
                timeFilter = `AND created_at > NOW() - INTERVAL '${timeframe_hours} hours'`;
            }

            const res = await query(
                `SELECT 1 FROM events 
                 WHERE contact_id = $1 AND organization_id = $2 
                 AND type = 'email_opened' 
                 ${timeFilter} 
                 LIMIT 1`,
                [contactId, organizationId]
            );

            return res.rows.length > 0;
        }

        return false;
    }
};
