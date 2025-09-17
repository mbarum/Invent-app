import db from '../db';

/**
 * Creates a new notification for a user.
 * It includes a check to prevent duplicate notifications for certain types (e.g., low stock alerts)
 * from being created in rapid succession for the same entity.
 *
 * @param userId - The ID of the user to notify.
 * @param message - The notification message to be displayed.
 * @param link - The frontend URL the notification should navigate to on click.
 * @param type - An optional category for the notification, used for de-duplication.
 * @param entityId - An optional ID of the entity related to the notification (e.g., a stock request ID).
 */
export const createNotification = async (
    userId: string, 
    message: string, 
    link: string,
    type?: string,
    entityId?: number | string
): Promise<void> => {
    try {
        // De-duplication: If a similar, recent, unread notification exists, do not create a new one.
        if (type && entityId) {
            const existing = await db('notifications')
                .where({
                    userId,
                    type,
                    entityId: String(entityId),
                    isRead: false,
                })
                // Check for notifications within the last hour to avoid spamming
                .where('createdAt', '>', db.raw('NOW() - INTERVAL 1 HOUR'))
                .first();

            if (existing) {
                // A recent, relevant notification already exists. Skip creating another.
                return;
            }
        }

        await db('notifications').insert({
            userId,
            message,
            link,
            type,
            entityId: entityId ? String(entityId) : null,
            isRead: false,
        });
    } catch (error) {
        console.error(`Failed to create notification for user ${userId}:`, error);
        // This error is logged but not re-thrown to prevent notification failures
        // from halting the primary application logic (e.g., creating a stock request).
    }
};
