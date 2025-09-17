import db from '../db';

/**
 * Asynchronously records an audit log entry into the database.
 * This function is designed to not throw errors to prevent a logging failure
 * from crashing a critical application process.
 *
 * @param userId - The UUID of the user performing the action.
 * @param action - A string identifier for the action (e.g., 'PRODUCT_CREATE').
 * @param details - A JSON object containing relevant data about the action.
 */
export const auditLog = async (userId: string, action: string, details: object): Promise<void> => {
    try {
        await db('audit_logs').insert({
            userId,
            action,
            details: JSON.stringify(details),
        });
    } catch (error) {
        console.error('CRITICAL: Failed to write to audit log.', {
            userId,
            action,
            error
        });
        // This failure is logged to the console but does not propagate
        // to ensure that logging issues do not interrupt application flow.
    }
};
