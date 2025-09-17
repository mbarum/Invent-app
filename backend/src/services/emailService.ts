import nodemailer from 'nodemailer';
import { ApplicationStatus } from '@masuma-ea/types';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        await transporter.sendMail({
            from: `"Masuma EA" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
        });
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
        // In a production app, you might want to add more robust error handling or a retry mechanism.
    }
};

export const sendApplicationReceivedEmail = async (to: string, name: string) => {
    const subject = 'Your Masuma EA Wholesale Application has been Received';
    const html = `
        <h1>Thank you for your application, ${name}!</h1>
        <p>We have successfully received your application for a Masuma East Africa wholesale account.</p>
        <p>Our team will review your details and documents. You will receive another email once your application has been approved or if we require further information.</p>
        <p>Thank you,</p>
        <p>The Masuma EA Team</p>
    `;
    await sendEmail(to, subject, html);
};

export const sendApplicationStatusEmail = async (to: string, name: string, status: ApplicationStatus) => {
    let subject = '';
    let html = '';

    if (status === ApplicationStatus.APPROVED) {
        subject = 'Your Masuma EA Wholesale Application is Approved!';
        html = `
            <h1>Congratulations, ${name}!</h1>
            <p>Your application for a Masuma East Africa wholesale account has been <strong>approved</strong>.</p>
            <p>You can now log in to the B2B portal using the email and password you provided during registration to start making stock requests.</p>
            <p>Welcome aboard!</p>
            <p>The Masuma EA Team</p>
        `;
    } else if (status === ApplicationStatus.REJECTED) {
        subject = 'Update on Your Masuma EA Wholesale Application';
        html = `
            <h1>Hello ${name},</h1>
            <p>Thank you for your interest in a Masuma East Africa wholesale account. After careful review, we regret to inform you that your application could not be approved at this time.</p>
            <p>If you believe this is in error or have further questions, please contact our support team.</p>
            <p>Sincerely,</p>
            <p>The Masuma EA Team</p>
        `;
    }

    if (subject && html) {
        await sendEmail(to, subject, html);
    }
};
