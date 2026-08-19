import sendEmail from './email.js';

// Serves both sign-up and the second step of an email change (Better Auth sends
// this to the NEW address once the current one is confirmed and does not
// distinguish the two callers), so the copy stays address-neutral, not a
// sign-up "welcome".
export const sendVerificationEmail = ({ user, url }: { user: { email: string }; url: string }) =>
    sendEmail(
        user.email,
        'Confirm your DivvyUp email',
        `Confirm this email address for DivvyUp:\n\n${url}\n\nIf you did not request this, ignore this email.`,
    );

export const sendChangeEmailConfirmation = ({
    user,
    newEmail,
    url,
}: {
    user: { email: string };
    newEmail: string;
    url: string;
}) =>
    // Goes to the current address, not the new one: confirming from it is what
    // proves a hijacked session cannot move the account.
    sendEmail(
        user.email,
        'Confirm your DivvyUp email change',
        `You asked to change your DivvyUp email to ${newEmail}. Confirm from your current address:\n\n${url}\n\nWe will then email ${newEmail} a link to finish the change. If you did not request this, ignore this email and your address stays the same.`,
    );
