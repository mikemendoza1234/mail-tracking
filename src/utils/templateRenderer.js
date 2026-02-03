/**
 * Simple template renderer
 * Replaces {{variable}} with values from context
 * Supports dot notation for nested objects (e.g. {{contact.firstName}})
 */
export function render(template, context) {
    if (!template) return '';

    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const keys = path.trim().split('.');
        let value = context;

        for (const key of keys) {
            value = value?.[key];
        }

        return value !== undefined ? value : '';
    });
}
