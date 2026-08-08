import sendgrid from '@sendgrid/mail';
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = (to, subject, text) => {
    const msg = {
        to,
        from: {
            email: process.env.SENDGRID_EMAIL,
            name: 'DivvyUp'
        },
        subject,
        text
    }
    sendgrid.send(msg);
};

export default sendEmail;