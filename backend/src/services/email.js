import { Resend } from 'resend';

const DEFAULT_FROM = 'DivvyUp <onboarding@resend.dev>';

const sendEmail = async (to, subject, text) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM || DEFAULT_FROM,
        to,
        subject,
        text
    });
    if (error) {
        throw new Error(error.message);
    }
};

export default sendEmail;
