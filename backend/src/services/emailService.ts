import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// --- SMTP Configuration ---
// NOTE: These environment variables must be set in your .env file for emails to work.
const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_PORT === '465'), // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
};

const transporter = nodemailer.createTransport(smtpConfig);

const SENDER_EMAIL = 'notifications@masuma.africa';

// Verify transporter configuration on startup
if (smtpConfig.host && smtpConfig.auth.user) {
    transporter.verify((error, success) => {
        if (error) {
            console.error('❌ Email service (SMTP) configuration error:', error.message);
        } else {
            console.log('✅ Email service (SMTP) is configured and ready to send messages.');
        }
    });
} else {
    console.warn('⚠️ Email service (SMTP) is not configured. Environment variables (SMTP_HOST, SMTP_USER, etc.) are missing. Emails will not be sent.');
}

/**
 * Sends a notification email.
 * @param to The recipient's email address.
 * @param subject The email subject.
 * @param html The HTML body of the email.
 */
export const sendNotificationEmail = async (to: string, subject: string, html: string): Promise<void> => {
    // Don't attempt to send if the service isn't configured.
    if (!smtpConfig.host || !smtpConfig.auth.user) {
        console.log(`Skipping email to ${to} because email service is not configured.`);
        return;
    }

    const mailOptions = {
        from: `"Masuma EA Hub" <${SENDER_EMAIL}>`,
        to,
        subject,
        html,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to} with subject: "${subject}"`);
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        // We log the error but don't re-throw it, so the main application flow is not interrupted.
    }
};

// --- HTML TEMPLATE HELPERS ---

export const generateLowStockHtml = (productName: string, stock: number, partNumber: string, reorderAmount: number): string => `
  <div style="font-family: sans-serif; padding: 20px; color: #333;">
    <h2 style="color: #d9534f;">Low Stock Alert</h2>
    <p>This is an automated notification that the stock for the following product is running low:</p>
    <ul>
      <li><strong>Product:</strong> ${productName}</li>
      <li><strong>Part Number:</strong> ${partNumber}</li>
      <li><strong>Current Stock:</strong> ${stock} units</li>
      <li><strong>Recommended Reorder Quantity:</strong> ${reorderAmount} units</li>
    </ul>
    <p>Please take action to replenish the stock to avoid shortages.</p>
    <p style="font-size: 0.9em; color: #777;">Masuma EA Hub - Inventory Management</p>
  </div>
`;

export const generateNewB2BAppHtml = (appName: string, contactName: string): string => `
  <div style="font-family: sans-serif; padding: 20px; color: #333;">
    <h2 style="color: #5cb85c;">New B2B Application</h2>
    <p>A new wholesale account application has been submitted by:</p>
    <ul>
      <li><strong>Business Name:</strong> ${appName}</li>
      <li><strong>Contact Person:</strong> ${contactName}</li>
    </ul>
    <p>Please log in to the Masuma EA Hub to review and approve/reject the application.</p>
    <p style="font-size: 0.9em; color: #777;">Masuma EA Hub - B2B Management</p>
  </div>
`;

export const generateNewStockRequestHtml = (clientName: string, requestId: number): string => `
  <div style="font-family: sans-serif; padding: 20px; color: #333;">
    <h2 style="color: #337ab7;">New Stock Request Received</h2>
    <p>A new stock request has been submitted by B2B client <strong>${clientName}</strong>.</p>
    <ul>
      <li><strong>Request ID:</strong> REQ-${String(requestId).padStart(5, '0')}</li>
    </ul>
    <p>Please log in to the Masuma EA Hub to review the request details and take action.</p>
    <p style="font-size: 0.9em; color: #777;">Masuma EA Hub - Stock Request Management</p>
  </div>
`;